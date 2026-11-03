// PR 크기 검사 (CI 전용). docs/lessons.md 2026-11-03 항목에서 승격된 검사입니다.
// 폰에서 리뷰 가능한 크기를 유지하기 위해, 코드·테스트 변경 줄 수(추가+삭제)를 제한합니다.
// 사용: node scripts/check-pr-size.mjs <base-ref>   (예: origin/main)
// 예외: PR 커밋 메시지에 [size-override] 가 있으면 통과 (사람이 PR에서 보고 승인하는 전제).
import { execSync } from "node:child_process";

const LIMIT = 500;
const EXCLUDE = [/^package-lock\.json$/, /^docs\//];

const base = process.argv[2];
if (!base) {
  console.log("ℹ️  pr-size: base ref 없음 — 건너뜀 (CI의 PR 빌드에서만 실행)");
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { encoding: "utf8" });

const messages = run(`git log --format=%B ${base}..HEAD`);
if (messages.includes("[size-override]")) {
  console.log("⚠️  pr-size: [size-override] 로 크기 검사를 건너뜀 — 리뷰어 확인 필요");
  process.exit(0);
}

let changed = 0;
const counted = [];
for (const line of run(`git diff --numstat ${base}...HEAD`).split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [added, deleted, file] = line.split("\t");
  if (!file || EXCLUDE.some((re) => re.test(file))) continue;
  const n = (Number(added) || 0) + (Number(deleted) || 0);
  changed += n;
  counted.push(`${file} (${n})`);
}

if (changed > LIMIT) {
  console.error(`❌ PR이 너무 큽니다: 코드·테스트 변경 ${changed}줄 (한도 ${LIMIT}줄)`);
  console.error(`   작업을 더 작은 PR로 나누세요. 꼭 필요하면 커밋 메시지에 [size-override] 와 이유를 적으세요.`);
  console.error(`   집계 대상: ${counted.join(", ")}`);
  process.exit(1);
}
console.log(`✅ pr-size 통과: ${changed}줄 / 한도 ${LIMIT}줄`);
