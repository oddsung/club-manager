// 리드 자동 머지 관문. 리드는 `gh pr merge` 대신 이 스크립트로만 머지합니다.
// 사용: node scripts/agent-merge.mjs <PR 번호> [--dry-run]
// - docs/merge-policy.md 의 기계 검사(agent-merge-policy.mjs)를 모두 통과할 때만 머지합니다.
// - 결과는 PR 댓글로 남겨 매니저가 사후 감사합니다.
// - main 의 보호 규칙(PR·CI 필수)은 그대로이므로, 이 스크립트가 잘못되어도 CI 실패 PR은 GitHub가 거부합니다.
import { execFileSync } from "node:child_process";
import { evaluate, formatReport } from "./agent-merge-policy.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const number = Number(args.find((a) => /^\d+$/.test(a)));
if (!Number.isInteger(number) || number <= 0) {
  console.error("사용: node scripts/agent-merge.mjs <PR 번호> [--dry-run]");
  process.exit(2);
}

const gh = (...a) => JSON.parse(execFileSync("gh", ["api", ...a], { encoding: "utf8" }));
const remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
const repo = remote.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/)?.[1];
if (!repo) {
  console.error(`GitHub 저장소를 알 수 없습니다: ${remote}`);
  process.exit(2);
}

const p = gh(`repos/${repo}/pulls/${number}`);
const pr = { state: p.state, draft: p.draft, base: p.base.ref, head: p.head.ref, headSha: p.head.sha };
const files = gh(`repos/${repo}/pulls/${number}/files?per_page=100`)
  .map((f) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions }));
const checks = gh(`repos/${repo}/commits/${pr.headSha}/check-runs`).check_runs
  .map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion }));

// 배정 표는 main 기준 TASK 지시서에서 읽습니다 (PR이 지시서를 바꿔 스스로 배정할 수 없도록)
execFileSync("git", ["fetch", "-q", "origin", "main"]);
const taskFiles = execFileSync("git", ["ls-tree", "--name-only", "origin/main", "docs/tasks/"], { encoding: "utf8" })
  .split(/\r?\n/).filter((f) => f.endsWith(".md"));
const taskTexts = taskFiles.map((f) => execFileSync("git", ["show", `origin/main:${f}`], { encoding: "utf8" }));

const verdict = evaluate(pr, files, checks, taskTexts);
const report = formatReport(number, pr.headSha.slice(0, 7), verdict, dryRun ? "dry-run" : "merge");
console.log(report);

if (dryRun) process.exit(verdict.ok ? 0 : 1);

execFileSync("gh", ["api", "-X", "POST", `repos/${repo}/issues/${number}/comments`, "-f", `body=${report}`], { stdio: "ignore" });
if (!verdict.ok) process.exit(1);

// 검사한 커밋 그대로만 머지 (검사 후 새 커밋이 올라오면 GitHub가 거부)
gh("-X", "PUT", `repos/${repo}/pulls/${number}/merge`, "-f", "merge_method=merge", "-f", `sha=${pr.headSha}`);
console.log(`✅ PR #${number} 머지 완료`);
