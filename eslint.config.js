import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist"] },
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
  }
);
