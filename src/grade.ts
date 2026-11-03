// R-02: 실력 등급 체계. 종목마다 다르므로 설정값으로 주입한다.
// 등급은 정수 점수로 표현하며 높을수록 실력이 좋다.

export interface GradeLevel {
  readonly label: string;
  readonly score: number;
}

export interface GradeScale {
  /** 점수 오름차순 등급 목록. */
  readonly levels: readonly GradeLevel[];
  /** 이 체계에 존재하는 점수인지. */
  isValid(score: number): boolean;
  /** 라벨(예: "A") → 점수. 없으면 오류. */
  scoreOf(label: string): number;
  /** 점수 → 라벨. 없으면 오류. */
  labelOf(score: number): string;
}

/**
 * 라벨 → 점수 매핑으로 등급 체계를 만든다.
 * 예: createGradeScale({ A: 4, B: 3, C: 2, D: 1 })
 */
export function createGradeScale(mapping: Readonly<Record<string, number>>): GradeScale {
  const entries = Object.entries(mapping);
  if (entries.length === 0) {
    throw new Error("등급 체계에는 최소 1개의 등급이 필요합니다.");
  }
  const byLabel = new Map<string, number>();
  const byScore = new Map<number, string>();
  for (const [label, score] of entries) {
    if (label.trim() === "") throw new Error("등급 라벨은 비어 있을 수 없습니다.");
    if (!Number.isInteger(score)) throw new Error(`등급 점수는 정수여야 합니다: ${label}=${score}`);
    if (byScore.has(score)) throw new Error(`등급 점수가 중복됩니다: ${score}`);
    byLabel.set(label, score);
    byScore.set(score, label);
  }
  const levels = [...byScore.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([score, label]) => Object.freeze({ label, score }));

  return Object.freeze({
    levels: Object.freeze(levels),
    isValid: (score: number) => byScore.has(score),
    scoreOf(label: string): number {
      const score = byLabel.get(label);
      if (score === undefined) throw new Error(`알 수 없는 등급 라벨: ${label}`);
      return score;
    },
    labelOf(score: number): string {
      const label = byScore.get(score);
      if (label === undefined) throw new Error(`알 수 없는 등급 점수: ${score}`);
      return label;
    },
  });
}

/** min~max 정수 범위 등급 체계 (라벨은 숫자 문자열). 예: rangeGradeScale(1, 5) */
export function rangeGradeScale(min: number, max: number): GradeScale {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`잘못된 등급 범위: ${min}~${max}`);
  }
  const mapping: Record<string, number> = {};
  for (let s = min; s <= max; s++) mapping[String(s)] = s;
  return createGradeScale(mapping);
}
