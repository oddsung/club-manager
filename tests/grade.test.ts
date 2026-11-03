import { describe, expect, it } from "vitest";
import { createGradeScale, rangeGradeScale } from "../src/grade";

describe("R-02 실력 등급 체계 (설정값 주입)", () => {
  it("1~5 정수 범위 체계", () => {
    const scale = rangeGradeScale(1, 5);
    expect(scale.levels.map((l) => l.score)).toEqual([1, 2, 3, 4, 5]);
    expect(scale.isValid(3)).toBe(true);
    expect(scale.isValid(0)).toBe(false);
    expect(scale.isValid(6)).toBe(false);
  });

  it("A~D 라벨을 점수로 매핑 (높을수록 실력이 좋음)", () => {
    const scale = createGradeScale({ A: 4, B: 3, C: 2, D: 1 });
    expect(scale.scoreOf("A")).toBe(4);
    expect(scale.scoreOf("D")).toBe(1);
    expect(scale.labelOf(3)).toBe("B");
    expect(scale.levels.map((l) => l.label)).toEqual(["D", "C", "B", "A"]);
  });

  it("알 수 없는 라벨/점수는 오류", () => {
    const scale = createGradeScale({ A: 4, B: 3 });
    expect(() => scale.scoreOf("Z")).toThrow();
    expect(() => scale.labelOf(99)).toThrow();
  });

  it("점수는 정수여야 한다", () => {
    expect(() => createGradeScale({ A: 1.5 })).toThrow(/정수/);
  });

  it("점수 중복, 빈 체계, 빈 라벨, 잘못된 범위는 오류", () => {
    expect(() => createGradeScale({ A: 1, B: 1 })).toThrow(/중복/);
    expect(() => createGradeScale({})).toThrow();
    expect(() => createGradeScale({ " ": 1 })).toThrow();
    expect(() => rangeGradeScale(5, 1)).toThrow();
  });
});
