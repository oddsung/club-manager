// R-03: 모임 당일 팀 자동 편성 (실력 균형 + 무작위). 종목 독립적.
//
// 알고리즘: 무작위 시작 배정 + 교환(swap) 지역 탐색을 여러 번 반복(multi-start)하고,
//           팀 간 등급 합계 최대 차이가 가장 작은 결과를 고른다.
//  1) 활성 회원을 시드 RNG로 셔플 → 앞에서부터 teamCount × teamSize 명 출전, 나머지는 대기(무작위).
//  2) 출전자를 다시 셔플해 팀에 고르게 나눈다(무작위 시작점).
//  3) 서로 다른 두 팀의 회원 한 쌍을 맞바꿔 팀 합계의 제곱합(분산)이 줄면 교환한다. 더 이상 줄지 않을 때까지.
//  4) 2~3을 TRIALS 번 반복해 (최대-최소 차이, 분산)이 가장 작은 편성을 고른다.
//
// 보장: 3)이 끝난 상태에서는 어떤 두 팀의 합계 차이도 (출전자 최고 등급 − 최저 등급) 이하이다.
//  증명: 팀 A 합계 − 팀 B 합계 = D > R(등급 범위) 라고 하자. 인원이 같으므로 A의 어떤 회원 a가
//  B의 어떤 회원 b보다 등급이 높다(아니면 A ≤ B). d = a − b 는 1 ≤ d ≤ R < D 이므로
//  a, b 교환은 분산을 줄인다(d·(d − D) < 0) → 지역 최적이라는 가정과 모순.
import type { Member } from "./members";
import { createRng, randomSeed, shuffle, type Rng } from "./rng";

export interface Team {
  readonly members: readonly Member[];
  readonly gradeTotal: number;
}

export interface TeamFormationInput {
  /** 당일 참석 회원 목록. 비활성 회원은 자동으로 제외된다. */
  attendees: readonly Member[];
  teamCount: number;
  teamSize: number;
  /** 같은 시드 → 같은 결과. 생략하면 매번 무작위 시드를 사용한다. */
  seed?: number;
}

export interface TeamFormationResult {
  readonly teams: readonly Team[];
  /** 팀에 들어가지 못한 인원 (현재 선정 기준: 무작위). */
  readonly waiting: readonly Member[];
  /** 팀 간 등급 합계 최대 차이 (max − min). */
  readonly spread: number;
  /** 실제 사용한 시드 — 결과 재현용. */
  readonly seed: number;
}

/** 시작점 반복 횟수. 인원이 수십 명 수준이라 비용은 작고, 최적해에 가까워지는 효과가 크다. */
const TRIALS = 30;

export function formTeams(input: TeamFormationInput): TeamFormationResult {
  const { attendees, teamCount, teamSize } = input;
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    throw new Error(`팀 수는 1 이상의 정수여야 합니다: ${teamCount}`);
  }
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    throw new Error(`팀당 인원수는 1 이상의 정수여야 합니다: ${teamSize}`);
  }
  const ids = new Set<string>();
  for (const m of attendees) {
    if (ids.has(m.id)) throw new Error(`참석 목록에 같은 회원이 중복되어 있습니다: ${m.id}`);
    ids.add(m.id);
  }

  const active = attendees.filter((m) => m.active);
  const needed = teamCount * teamSize;
  if (active.length < needed) {
    throw new Error(
      `참석 인원이 부족합니다: 활성 참석자 ${active.length}명, 필요 ${needed}명 (${teamCount}팀 × ${teamSize}명)`,
    );
  }

  const seed = input.seed ?? randomSeed();
  const rng = createRng(seed);

  const pool = shuffle(active, rng);
  const players = pool.slice(0, needed);
  const waiting = pool.slice(needed);

  let best: Member[][] | undefined;
  let bestScore: [number, number] = [Infinity, Infinity];
  for (let t = 0; t < TRIALS; t++) {
    const teams = improveBySwaps(randomPartition(players, teamCount, rng));
    const score = evaluate(teams);
    if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = teams;
      bestScore = score;
    }
  }

  const teams = (best ?? []).map((members) =>
    Object.freeze({ members: Object.freeze(members), gradeTotal: total(members) }),
  );
  return Object.freeze({
    teams: Object.freeze(teams),
    waiting: Object.freeze(waiting),
    spread: bestScore[0],
    seed,
  });
}

function total(members: readonly Member[]): number {
  return members.reduce((sum, m) => sum + m.grade, 0);
}

function randomPartition(players: readonly Member[], teamCount: number, rng: Rng): Member[][] {
  const shuffled = shuffle(players, rng);
  const teams: Member[][] = Array.from({ length: teamCount }, () => []);
  shuffled.forEach((m, i) => teams[i % teamCount]?.push(m));
  return teams;
}

/** [최대-최소 차이, 평균 대비 편차 제곱합] — 둘 다 작을수록 균형. */
function evaluate(teams: readonly Member[][]): [number, number] {
  const totals = teams.map(total);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const variance = totals.reduce((s, x) => s + (x - mean) ** 2, 0);
  return [Math.max(...totals) - Math.min(...totals), variance];
}

/**
 * 두 팀 간 한 명씩 교환해 합계 제곱합이 줄면 교환한다 (first-improvement).
 * 매 교환마다 제곱합이 정수 단위로 엄격히 감소하므로 반드시 종료한다.
 */
function improveBySwaps(teams: Member[][]): Member[][] {
  const totals = teams.map(total);
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 0; a < teams.length; a++) {
      for (let b = a + 1; b < teams.length; b++) {
        const A = teams[a] as Member[];
        const B = teams[b] as Member[];
        for (let i = 0; i < A.length; i++) {
          for (let j = 0; j < B.length; j++) {
            const ma = A[i] as Member;
            const mb = B[j] as Member;
            const d = ma.grade - mb.grade; // 교환 시 A 합계는 d 만큼 감소, B는 증가
            const diff = (totals[a] as number) - (totals[b] as number);
            // (Ta-d)² + (Tb+d)² < Ta² + Tb²  ⇔  d·(d − diff) < 0
            if (d * (d - diff) < 0) {
              A[i] = mb;
              B[j] = ma;
              totals[a] = (totals[a] as number) - d;
              totals[b] = (totals[b] as number) + d;
              improved = true;
            }
          }
        }
      }
    }
  }
  return teams;
}
