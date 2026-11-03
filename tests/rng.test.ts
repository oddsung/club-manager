import { describe, expect, it } from "vitest";
import { createRng, randomSeed, shuffle } from "../src/rng";

describe("RNG (R-03 시드 주입)", () => {
  it("같은 시드 → 같은 수열", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, a);
    const seqB = Array.from({ length: 10 }, b);
    expect(seqA).toEqual(seqB);
  });

  it("다른 시드 → 다른 수열", () => {
    const a = Array.from({ length: 5 }, createRng(1));
    const b = Array.from({ length: 5 }, createRng(2));
    expect(a).not.toEqual(b);
  });

  it("값은 [0, 1) 범위", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("정수가 아닌 시드는 오류", () => {
    expect(() => createRng(1.5)).toThrow();
  });

  it("셔플은 원소를 보존하고 원본을 바꾸지 않는다", () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(src, createRng(3));
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(src);
  });

  it("randomSeed 는 32비트 정수", () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
});
