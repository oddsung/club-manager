import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", ".worktrees"] },
  ...tseslint.configs.strict,
  {
    rules: {
      // 에이전트가 타입 검사를 우회하지 못하도록 강제
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      // 도메인 로직에서 Math.random 직접 사용 금지 → 시드 주입 가능한 난수 사용 (R-03)
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "R-03: 난수는 주입 가능한 RNG를 사용하세요 (테스트 재현성)." }
      ]
    }
  },
  {
    // R-04~R-06: 현재 시각은 주입받는다 (테스트 재현성). 도메인 코드에서 시스템 시계 직접 사용 금지
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "현재 시각은 인자로 주입받으세요 (now: Date)." },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: "현재 시각은 인자로 주입받으세요 (now: Date)." }
      ]
    }
  }
);
