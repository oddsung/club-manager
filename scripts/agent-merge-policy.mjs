// 리드 자동 머지 정책 — 순수 함수 (테스트 가능). docs/merge-policy.md 의 기계 검사 부분.
// 이 파일과 agent-merge.mjs 는 사람만 수정합니다 (.claude/settings.json ask 규칙).

export const SIZE_LIMIT = 500;

/** 리드가 머지해도 되는 docs 파일 (결정이 없는 기록) */
const LEAD_DOCS = new Set(["docs/progress.md", "docs/lessons.md"]);

/**
 * TASK 지시서의 상태 줄만 바꾼 변경인지 (예: "> 상태: 대기" → "> 상태: 완료").
 * 지시서 내용(요구사항·배정)을 바꾸는 것은 결정이므로 사람이 머지한다.
 */
export function isTaskStatusOnly(file) {
  if (!/^docs\/tasks\/[^/]+\.md$/.test(file.filename) || file.status !== "modified" || !file.patch) return false;
  const changed = file.patch.split(/\r?\n/).filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  return changed.length > 0 && changed.every((l) => /^[+-]\s*>\s*상태:\s*(대기|진행 중|완료)\s*$/.test(l));
}

/** 바뀌면 무조건 사람이 머지해야 하는 경로 */
const HUMAN_ONLY = [
  /^\.claude\//,
  /^\.github\//,
  /^scripts\//,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^package(-lock)?\.json$/,
  /^eslint\.config\.js$/,
  /^tsconfig\.json$/,
  /^vitest\.config\.ts$/,
];

/**
 * TASK 지시서들에서 팀원(브랜치 이름)에게 배정된 파일 목록을 찾는다.
 * 배정 표의 한 줄에 `팀원이름` 이 있으면, 같은 줄의 `src/...`, `tests/...` 경로를 배정 파일로 본다.
 */
export function assignedFiles(teammate, taskTexts) {
  const files = new Set();
  for (const text of taskTexts) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim().startsWith("|") || !line.includes(`\`${teammate}\``)) continue;
      for (const m of line.matchAll(/`((?:src|tests)\/[^`]+)`/g)) files.add(m[1]);
    }
  }
  return files;
}

/**
 * @param {object} pr   { state, draft, base, head, headSha }
 * @param {Array<{filename:string,status:string,additions:number,deletions:number}>} files
 * @param {Array<{name:string,status:string,conclusion:string|null}>} checks
 * @param {string[]} taskTexts  docs/tasks/*.md 내용
 * @returns {{ ok: boolean, results: Array<{id:string, ok:boolean, detail:string}> }}
 */
export function evaluate(pr, files, checks, taskTexts) {
  const results = [];
  const add = (id, ok, detail) => results.push({ id, ok, detail });

  add("기본", pr.state === "open" && !pr.draft && pr.base === "main" && pr.head.startsWith("agent/"),
    `state=${pr.state}, draft=${pr.draft}, ${pr.head} → ${pr.base} (열린 agent/* → main PR만)`);

  const main = checks.find((c) => c.name === "check");
  const allGreen = checks.length > 0 && checks.every((c) => c.status === "completed" && c.conclusion === "success");
  add("P1 CI", Boolean(main) && allGreen,
    main ? checks.map((c) => `${c.name}=${c.conclusion ?? c.status}`).join(", ") : "check 결과 없음");

  const human = files.filter((f) => HUMAN_ONLY.some((re) => re.test(f.filename)));
  add("사람 전용 파일 없음", human.length === 0, human.length ? human.map((f) => f.filename).join(", ") : "없음");

  const code = files.filter((f) => /^(src|tests)\//.test(f.filename));
  const docs = files.filter((f) => f.filename.startsWith("docs/"));
  const decisionDocs = docs.filter((f) => !LEAD_DOCS.has(f.filename) && !isTaskStatusOnly(f));
  add("결정 문서 없음", decisionDocs.length === 0,
    decisionDocs.length ? `사람 확정이 필요한 문서: ${decisionDocs.map((f) => f.filename).join(", ")}` : "없음");

  const other = files.filter((f) => !/^(src|tests|docs)\//.test(f.filename) && !human.includes(f));
  add("알 수 없는 경로 없음", other.length === 0, other.length ? other.map((f) => f.filename).join(", ") : "없음");

  const lines = code.reduce((n, f) => n + f.additions + f.deletions, 0);
  add("P2 크기", lines <= SIZE_LIMIT, `코드·테스트 ${lines}줄 / 한도 ${SIZE_LIMIT}줄`);

  if (code.length > 0) {
    const teammate = pr.head.slice("agent/".length);
    const assigned = assignedFiles(teammate, taskTexts);
    const outside = code.filter((f) => !assigned.has(f.filename));
    add("P3 배정 파일만", assigned.size > 0 && outside.length === 0,
      assigned.size === 0
        ? `TASK 배정 표에서 \`${teammate}\` 를 찾지 못함`
        : outside.length ? `배정 밖: ${outside.map((f) => f.filename).join(", ")}` : `배정 ${assigned.size}개 안에서만 변경`);

    const touchesSrc = code.some((f) => f.filename.startsWith("src/"));
    const touchesTests = code.some((f) => f.filename.startsWith("tests/"));
    add("P4 src면 tests 동반", !touchesSrc || touchesTests, touchesSrc ? `tests 변경 ${touchesTests ? "있음" : "없음"}` : "src 변경 없음");

    const testRewrite = code.filter((f) => f.filename.startsWith("tests/") && (f.status === "removed" || (f.status !== "added" && f.deletions > 0)));
    add("기존 테스트 수정·삭제 없음", testRewrite.length === 0,
      testRewrite.length ? testRewrite.map((f) => `${f.filename} (${f.status}, -${f.deletions})`).join(", ") : "추가만 있음");
  }

  return { ok: results.every((r) => r.ok), results };
}

export function formatReport(prNumber, shortSha, verdict, mode) {
  const head = verdict.ok
    ? mode === "dry-run" ? "통과 (dry-run — 머지하지 않음)" : "통과 → 리드가 머지"
    : "보류 → 사람이 확인";
  const lines = verdict.results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.id}: ${r.detail}`);
  return [`🤖 리드 자동 머지 검사 (PR #${prNumber}, 커밋 ${shortSha}): ${head}`, ...lines,
    "", "※ `scripts/agent-merge.mjs` 의 기계 검사 결과입니다. 통합 점검·/verify 보고·해석 확인(정책 3~5)은 리드가 보고서에 기록합니다."].join("\n");
}
