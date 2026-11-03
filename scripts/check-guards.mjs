// 스택과 무관한 안전 검사 (Windows / macOS / Linux 공통).
// AGENTS.md "금지 사항" 중 기계적으로 잡을 수 있는 것을 강제합니다.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const problems = [];

// 1) .env 파일이 git에 올라가 있으면 실패 (.env.example 은 허용)
try {
  const tracked = execSync("git ls-files", { encoding: "utf8" }).split(/\r?\n/);
  const envFiles = tracked.filter(
    (f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".env.example"),
  );
  if (envFiles.length > 0) problems.push(`.env 파일이 커밋되어 있습니다: ${envFiles.join(", ")}`);
} catch {
  // git 저장소가 아니면 건너뜀
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function scan(dirs, pattern, label) {
  const hits = [];
  for (const file of dirs.flatMap(walk)) {
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  if (hits.length > 0) problems.push(`${label}\n  ${hits.join("\n  ")}`);
}

// 2) 흔한 비밀값 패턴
scan(
  ["src", "tests"],
  /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/,
  "비밀값으로 보이는 문자열이 있습니다:",
);

// 3) 테스트 건너뛰기(skip/only) — 테스트를 꺼서 통과시키는 것을 막음
scan(
  ["tests"],
  /(\.skip\(|\.only\(|\bxit\(|\bxdescribe\()/,
  "테스트 skip/only 표시가 있습니다 (docs/lessons.md에 사유를 남기고 사람이 승인해야 함):",
);

if (problems.length > 0) {
  for (const p of problems) console.error(`❌ ${p}`);
  process.exit(1);
}
console.log("✅ guards 통과");
