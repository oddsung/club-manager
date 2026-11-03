import { configDefaults, defineConfig } from "vitest/config";

// .worktrees/ 는 에이전트 팀원의 작업 폴더 — 루트 검사에서 제외 (각 worktree에서 따로 검사)
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".worktrees/**"],
  },
});
