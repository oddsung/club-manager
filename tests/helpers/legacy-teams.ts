// 테스트 전용 비교 기준: Q6 이전의 팀 편성 (대기 인원 = 무작위 선정).
// main e817e56 의 src/teams.ts 알고리즘을 그대로 옮긴 것. 입력 검증은 생략하고 spread 만 계산한다.
// Q6 "무작위 선정(기존 방식)보다 spread 가 나빠지지 않음"을 같은 입력·같은 시드로 비교하는 데 쓴다.
import type { Member } from "../../src/members";
import { createRng, shuffle } from "../../src/rng";

const TRIALS = 30;

const total = (ms: readonly Member[]) => ms.reduce((s, m) => s + m.grade, 0);

export function legacySpread(attendees: readonly Member[], teamCount: number, teamSize: number, seed: number): number {
  const rng = createRng(seed);
  const players = shuffle(
    attendees.filter((m) => m.active),
    rng,
  ).slice(0, teamCount * teamSize);
  let best: [number, number] = [Infinity, Infinity];
  for (let t = 0; t < TRIALS; t++) {
    const teams: Member[][] = Array.from({ length: teamCount }, () => []);
    shuffle(players, rng).forEach((m, i) => teams[i % teamCount]?.push(m));
    const totals = teams.map(total);
    let improved = true;
    while (improved) {
      improved = false;
      for (let a = 0; a < teams.length; a++) {
        for (let b = a + 1; b < teams.length; b++) {
          const A = teams[a] ?? [];
          const B = teams[b] ?? [];
          for (let i = 0; i < A.length; i++) {
            for (let j = 0; j < B.length; j++) {
              const ma = A[i];
              const mb = B[j];
              if (!ma || !mb) continue;
              const d = ma.grade - mb.grade;
              const diff = (totals[a] ?? 0) - (totals[b] ?? 0);
              if (d * (d - diff) < 0) {
                A[i] = mb;
                B[j] = ma;
                totals[a] = (totals[a] ?? 0) - d;
                totals[b] = (totals[b] ?? 0) + d;
                improved = true;
              }
            }
          }
        }
      }
    }
    const mean = totals.reduce((x, y) => x + y, 0) / totals.length;
    const score: [number, number] = [
      Math.max(...totals) - Math.min(...totals),
      totals.reduce((s, x) => s + (x - mean) ** 2, 0),
    ];
    if (score[0] < best[0] || (score[0] === best[0] && score[1] < best[1])) best = score;
  }
  return best[0];
}
