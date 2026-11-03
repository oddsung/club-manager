// R-03: 시드 주입 가능한 난수 생성기. Math.random 은 lint 로 금지되어 있다.

/** [0, 1) 범위의 실수를 반환하는 난수 함수. */
export type Rng = () => number;

/**
 * mulberry32 — 32비트 상태의 작고 빠른 PRNG.
 * 같은 시드 → 항상 같은 수열. 암호용이 아니라 팀 편성 같은 게임 용도.
 */
export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed)) {
    throw new Error(`시드는 정수여야 합니다: ${seed}`);
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드를 지정하지 않았을 때 쓰는 무작위 시드 (crypto 기반). */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] ?? 0;
}

/** [0, n) 범위의 정수. */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates 셔플. 원본은 바꾸지 않고 새 배열을 반환한다. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
