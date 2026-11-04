import { describe, expect, it } from "vitest";
import { assignedFiles, evaluate } from "../scripts/agent-merge-policy.mjs";

const TASK = `
| 팀원 | 다룰 Qn | 고칠 파일 (이 파일만) |
|---|---|---|
| \`fix-dues\` | Q10 | \`src/dues.ts\`, \`tests/dues.edge.test.ts\` |
| \`fix-attendance\` | Q13 | \`src/attendance.ts\`, \`tests/attendance.edge.test.ts\` |
`;
const pr = (head = "agent/fix-dues", extra = {}) => ({ state: "open", draft: false, base: "main", head, headSha: "abc1234", ...extra });
const green = [{ name: "check", status: "completed", conclusion: "success" }];
const f = (filename, additions = 10, deletions = 0, status = "modified") => ({ filename, status, additions, deletions });
const failed = (v) => v.results.filter((r) => !r.ok).map((r) => r.id);

describe("리드 자동 머지 정책 (scripts/agent-merge-policy.mjs)", () => {
  it("배정 표에서 팀원의 파일만 읽는다", () => {
    expect([...assignedFiles("fix-dues", [TASK])]).toEqual(["src/dues.ts", "tests/dues.edge.test.ts"]);
    expect(assignedFiles("없는팀원", [TASK]).size).toBe(0);
  });

  it("조건을 모두 만족하면 통과", () => {
    const v = evaluate(pr(), [f("src/dues.ts"), f("tests/dues.edge.test.ts", 30, 0, "added")], green, [TASK]);
    expect(failed(v)).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("CI가 실패했거나 진행 중이면 보류", () => {
    const red = [{ name: "check", status: "completed", conclusion: "failure" }];
    const running = [{ name: "check", status: "in_progress", conclusion: null }];
    const files = [f("src/dues.ts"), f("tests/dues.edge.test.ts", 5, 0, "added")];
    expect(failed(evaluate(pr(), files, red, [TASK]))).toContain("P1 CI");
    expect(failed(evaluate(pr(), files, running, [TASK]))).toContain("P1 CI");
    expect(failed(evaluate(pr(), files, [], [TASK]))).toContain("P1 CI");
  });

  it("배정 밖 파일을 바꾸면 보류", () => {
    const v = evaluate(pr(), [f("src/dues.ts"), f("src/teams.ts"), f("tests/dues.edge.test.ts", 5, 0, "added")], green, [TASK]);
    expect(failed(v)).toContain("P3 배정 파일만");
  });

  it("배정 표에 없는 팀원이면 보류", () => {
    const v = evaluate(pr("agent/someone"), [f("src/x.ts"), f("tests/x.test.ts", 5, 0, "added")], green, [TASK]);
    expect(failed(v)).toContain("P3 배정 파일만");
  });

  it("500줄을 넘으면 보류", () => {
    const v = evaluate(pr(), [f("src/dues.ts", 400), f("tests/dues.edge.test.ts", 200, 0, "added")], green, [TASK]);
    expect(failed(v)).toContain("P2 크기");
  });

  it("src만 바꾸고 tests가 없으면 보류", () => {
    expect(failed(evaluate(pr(), [f("src/dues.ts")], green, [TASK]))).toContain("P4 src면 tests 동반");
  });

  it("기존 테스트를 고치거나 지우면 보류 (추가만 허용)", () => {
    const edited = evaluate(pr(), [f("src/dues.ts"), f("tests/dues.edge.test.ts", 5, 3)], green, [TASK]);
    const removed = evaluate(pr(), [f("src/dues.ts"), f("tests/dues.edge.test.ts", 0, 40, "removed")], green, [TASK]);
    const appended = evaluate(pr(), [f("src/dues.ts"), f("tests/dues.edge.test.ts", 5, 0)], green, [TASK]);
    expect(failed(edited)).toContain("기존 테스트 수정·삭제 없음");
    expect(failed(removed)).toContain("기존 테스트 수정·삭제 없음");
    expect(appended.ok).toBe(true);
  });

  it("규칙·설정·스크립트 파일이 있으면 보류", () => {
    for (const name of [".claude/settings.json", ".github/workflows/ci.yml", "AGENTS.md", "CLAUDE.md", "package.json", "scripts/agent-merge.mjs"]) {
      expect(failed(evaluate(pr("agent/task-docs"), [f(name)], green, [TASK])), name).toContain("사람 전용 파일 없음");
    }
  });

  it("결과 기록 docs(progress, lessons)만 있으면 통과, 결정 docs가 있으면 보류", () => {
    expect(evaluate(pr("agent/task-005-result"), [f("docs/progress.md"), f("docs/lessons.md")], green, [TASK]).ok).toBe(true);
    for (const name of ["docs/requirements.md", "docs/merge-policy.md", "docs/manager.md", "docs/tasks/006-x.md"]) {
      expect(failed(evaluate(pr("agent/task-docs"), [f(name)], green, [TASK])), name).toContain("결정 문서 없음");
    }
  });

  it("agent/* → main 이 아니거나 닫힌·초안 PR이면 보류", () => {
    const files = [f("docs/progress.md")];
    expect(failed(evaluate(pr("manager/issue-1"), files, green, [TASK]))).toContain("기본");
    expect(failed(evaluate(pr("setup/x"), files, green, [TASK]))).toContain("기본");
    expect(failed(evaluate(pr("agent/x", { state: "closed" }), files, green, [TASK]))).toContain("기본");
    expect(failed(evaluate(pr("agent/x", { draft: true }), files, green, [TASK]))).toContain("기본");
    expect(failed(evaluate(pr("agent/x", { base: "dev" }), files, green, [TASK]))).toContain("기본");
  });
});
