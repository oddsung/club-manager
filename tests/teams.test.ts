import { describe, expect, it } from "vitest";
import type { Member } from "../src/members";
import { createRng, randomInt, type Rng } from "../src/rng";
import { formTeams, type TeamFormationResult } from "../src/teams";

// 가짜 회원 생성 (실데이터 금지)
function fakeMembers(grades: readonly number[], prefix = "p"): Member[] {
  return grades.map((grade, i) => ({ id: `${prefix}${i}`, name: `가짜회원${i}`, grade, active: true }));
}

function randomGrades(rng: Rng, count: number, min: number, max: number): number[] {
  return Array.from({ length: count }, () => min + randomInt(rng, max - min + 1));
}

/** 편성 결과 구조가 올바른지 공통 확인. */
function expectValidResult(r: TeamFormationResult, attendees: readonly Member[], teamCount: number, teamSize: number) {
  expect(r.teams).toHaveLength(teamCount);
  for (const t of r.teams) {
    expect(t.members).toHaveLength(teamSize);
    expect(t.gradeTotal).toBe(t.members.reduce((s, m) => s + m.grade, 0));
  }
  const placed = [...r.teams.flatMap((t) => t.members), ...r.waiting].map((m) => m.id).sort();
  const expected = attendees.filter((m) => m.active).map((m) => m.id).sort();
  expect(placed).toEqual(expected); // 활성 참석자 전원이 정확히 한 번씩 (팀 또는 대기)
  const totals = r.teams.map((t) => t.gradeTotal);
  expect(r.spread).toBe(Math.max(...totals) - Math.min(...totals));
}

/** 팀 구성을 비교 가능한 문자열로 (팀 순서 무관). */
function signature(r: TeamFormationResult): string {
  return r.teams
    .map((t) => t.members.map((m) => m.id).sort().join(","))
    .sort()
    .join(" | ");
}

/** 소규모 입력의 최적 spread 를 완전 탐색으로 계산 (검증용 기준값). */
function optimalSpread(grades: readonly number[], teamCount: number, teamSize: number): number {
  const totals = new Array<number>(teamCount).fill(0);
  const counts = new Array<number>(teamCount).fill(0);
  let best = Infinity;
  const go = (i: number) => {
    if (i === grades.length) {
      best = Math.min(best, Math.max(...totals) - Math.min(...totals));
      return;
    }
    let openedEmpty = false;
    for (let t = 0; t < teamCount; t++) {
      if ((counts[t] as number) >= teamSize) continue;
      if (counts[t] === 0) {
        if (openedEmpty) continue; // 빈 팀끼리는 대칭 → 하나만 시도
        openedEmpty = true;
      }
      counts[t] = (counts[t] as number) + 1;
      totals[t] = (totals[t] as number) + (grades[i] as number);
      go(i + 1);
      counts[t] = (counts[t] as number) - 1;
      totals[t] = (totals[t] as number) - (grades[i] as number);
    }
  };
  go(0);
  return best;
}

describe("R-03 팀 자동 편성 — 기본 동작", () => {
  it("출력: 팀 목록(회원 + 등급 합계)", () => {
    const attendees = fakeMembers([5, 4, 3, 2, 1, 1, 2, 3]);
    const r = formTeams({ attendees, teamCount: 2, teamSize: 4, seed: 1 });
    expectValidResult(r, attendees, 2, 4);
    expect(r.waiting).toHaveLength(0);
  });

  it("같은 시드 → 같은 결과", () => {
    const attendees = fakeMembers(randomGrades(createRng(10), 20, 1, 5));
    const a = formTeams({ attendees, teamCount: 4, teamSize: 4, seed: 123 });
    const b = formTeams({ attendees, teamCount: 4, teamSize: 4, seed: 123 });
    expect(a.teams).toEqual(b.teams);
    expect(a.waiting).toEqual(b.waiting);
    expect(a.seed).toBe(123);
  });

  it("다른 시드 → 다른 구성이 나올 수 있다 (무작위성)", () => {
    const attendees = fakeMembers(randomGrades(createRng(11), 12, 1, 5));
    const sigs = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      sigs.add(signature(formTeams({ attendees, teamCount: 3, teamSize: 4, seed })));
    }
    expect(sigs.size).toBeGreaterThan(1);
  });

  it("등급이 모두 같아도 시드에 따라 구성이 달라진다", () => {
    const attendees = fakeMembers(new Array(8).fill(3));
    const sigs = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      sigs.add(signature(formTeams({ attendees, teamCount: 2, teamSize: 4, seed })));
    }
    expect(sigs.size).toBeGreaterThan(1);
  });

  it("시드를 생략하면 무작위 시드를 쓰고, 그 시드로 결과를 재현할 수 있다", () => {
    const attendees = fakeMembers(randomGrades(createRng(12), 10, 1, 5));
    const r = formTeams({ attendees, teamCount: 2, teamSize: 5 });
    const again = formTeams({ attendees, teamCount: 2, teamSize: 5, seed: r.seed });
    expect(signature(again)).toBe(signature(r));
  });

  it("입력 배열을 변경하지 않는다", () => {
    const attendees = fakeMembers([1, 2, 3, 4]);
    const copy = attendees.map((m) => m.id);
    formTeams({ attendees, teamCount: 2, teamSize: 2, seed: 5 });
    expect(attendees.map((m) => m.id)).toEqual(copy);
  });
});

describe("R-03 팀 자동 편성 — 인원 규칙", () => {
  it("참석 인원이 팀 수 × 팀당 인원수보다 적으면 오류", () => {
    const attendees = fakeMembers([1, 2, 3, 4, 5]);
    expect(() => formTeams({ attendees, teamCount: 2, teamSize: 3, seed: 1 })).toThrow(/부족/);
  });

  it("참석 인원이 더 많으면 남는 인원은 대기 목록으로 반환", () => {
    const attendees = fakeMembers([1, 2, 3, 4, 5, 1, 2]);
    const r = formTeams({ attendees, teamCount: 2, teamSize: 3, seed: 1 });
    expectValidResult(r, attendees, 2, 3);
    expect(r.waiting).toHaveLength(1);
  });

  it("대기 인원 선정은 무작위 (시드에 따라 달라짐)", () => {
    const attendees = fakeMembers([3, 3, 3, 3, 3, 3]);
    const waitingIds = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const r = formTeams({ attendees, teamCount: 2, teamSize: 2, seed });
      r.waiting.forEach((m) => waitingIds.add(m.id));
    }
    expect(waitingIds.size).toBeGreaterThan(2);
  });

  it("비활성 회원은 편성에서 제외 (팀에도 대기에도 없음)", () => {
    const attendees = fakeMembers([5, 5, 1, 1, 3, 3]).map((m, i) => (i < 2 ? { ...m, active: false } : m));
    const r = formTeams({ attendees, teamCount: 2, teamSize: 2, seed: 1 });
    expectValidResult(r, attendees, 2, 2);
    const all = [...r.teams.flatMap((t) => t.members), ...r.waiting];
    expect(all.some((m) => !m.active)).toBe(false);
  });

  it("비활성 회원 제외 후 인원이 모자라면 오류", () => {
    const attendees = fakeMembers([1, 2, 3, 4]).map((m, i) => (i === 0 ? { ...m, active: false } : m));
    expect(() => formTeams({ attendees, teamCount: 2, teamSize: 2, seed: 1 })).toThrow(/부족/);
  });

  it("팀 수·팀당 인원수가 1 이상의 정수가 아니면 오류", () => {
    const attendees = fakeMembers([1, 2, 3, 4]);
    expect(() => formTeams({ attendees, teamCount: 0, teamSize: 2 })).toThrow();
    expect(() => formTeams({ attendees, teamCount: 2, teamSize: 0 })).toThrow();
    expect(() => formTeams({ attendees, teamCount: 1.5, teamSize: 2 })).toThrow();
  });

  it("같은 회원이 참석 목록에 중복되면 오류", () => {
    const [a, b] = fakeMembers([1, 2]) as [Member, Member];
    expect(() => formTeams({ attendees: [a, b, a, b], teamCount: 2, teamSize: 2, seed: 1 })).toThrow(/중복/);
  });
});

describe("R-03 팀 자동 편성 — 종목 독립 (같은 로직으로 2·4·6·11명 팀)", () => {
  const sports = [
    { name: "배드민턴 복식", teamCount: 4, teamSize: 2 },
    { name: "족구", teamCount: 2, teamSize: 4 },
    { name: "배구", teamCount: 2, teamSize: 6 },
    { name: "축구", teamCount: 2, teamSize: 11 },
  ];
  for (const s of sports) {
    it(`${s.name}: ${s.teamCount}팀 × ${s.teamSize}명 (+대기 3명)`, () => {
      const attendees = fakeMembers(randomGrades(createRng(s.teamSize), s.teamCount * s.teamSize + 3, 1, 5));
      const r = formTeams({ attendees, teamCount: s.teamCount, teamSize: s.teamSize, seed: 99 });
      expectValidResult(r, attendees, s.teamCount, s.teamSize);
      expect(r.waiting).toHaveLength(3);
    });
  }
});

describe("R-03 팀 자동 편성 — 실력 균형 검증 (무작위 입력 반복)", () => {
  // 기준값 1 (하드 상한, 이론 보장): spread ≤ R, R = 출전자 중 최고 등급 − 최저 등급.
  //   근거: 교환 지역탐색이 끝난 상태에서 두 팀 합계 차이 D 가 R 보다 크면, 높은 팀에 낮은 팀보다
  //   등급이 높은 회원이 반드시 있고 그 둘을 맞바꾸면(1 ≤ d ≤ R < D) 분산이 줄어들므로 모순.
  //   즉 "한 명만 바꿔도 더 좋아지는 편성"은 절대 내놓지 않는다는 뜻이다. 등급 1~5 이면 최대 4.
  // 기준값 2 (실용 기준): 등급 1~5, 팀당 4명 이상에서 spread ≤ 1 인 비율 ≥ 95%.
  //   근거: 합계는 정수라 총합이 팀 수로 나누어떨어지지 않으면 0 이 불가능하고 1 이 최선인 경우가 흔하다.
  //   사람이 손으로 짜도 "1점 차"면 균형으로 받아들이는 수준. 측정값은 97.5~100% 였고 95% 는 그보다
  //   보수적인 하한이다(시드 고정이라 결과는 결정적 → flaky 하지 않음).
  //   팀당 2명은 제외: 인원이 적어 1점 차 편성 자체가 존재하지 않는 입력이 많다(측정 58%).
  //   이 경우는 알고리즘 문제가 아니므로 아래 기준값 3(완전탐색 최적값 비교)으로 검증한다.
  // 기준값 3 (최적성): 완전탐색이 가능한 소규모 입력에서 최적 spread 와 같은 비율 ≥ 95%, 차이는 최대 1.
  const configs = [
    { teamCount: 4, teamSize: 2 },
    { teamCount: 2, teamSize: 4 },
    { teamCount: 3, teamSize: 4 },
    { teamCount: 2, teamSize: 6 },
    { teamCount: 2, teamSize: 11 },
    { teamCount: 4, teamSize: 6 },
  ];
  const RUNS = 200;

  it(`하드 상한: 모든 경우 spread ≤ (최고 등급 − 최저 등급)  [${configs.length}개 구성 × ${RUNS}회]`, () => {
    const rng = createRng(2026);
    for (const c of configs) {
      for (let run = 0; run < RUNS; run++) {
        const n = c.teamCount * c.teamSize + randomInt(rng, 4);
        const attendees = fakeMembers(randomGrades(rng, n, 1, 5));
        const r = formTeams({ ...c, attendees, seed: run });
        const players = r.teams.flatMap((t) => t.members.map((m) => m.grade));
        const range = Math.max(...players) - Math.min(...players);
        expect(r.spread).toBeLessThanOrEqual(range);
      }
    }
  });

  it("실용 기준: 등급 1~5, 팀당 4명 이상에서 spread ≤ 1 인 비율 ≥ 95%", () => {
    const rng = createRng(77);
    for (const c of configs.filter((x) => x.teamSize >= 4)) {
      let good = 0;
      for (let run = 0; run < RUNS; run++) {
        const attendees = fakeMembers(randomGrades(rng, c.teamCount * c.teamSize, 1, 5));
        if (formTeams({ ...c, attendees, seed: run }).spread <= 1) good++;
      }
      expect(good / RUNS, `${c.teamCount}팀×${c.teamSize}명`).toBeGreaterThanOrEqual(0.95);
    }
  });

  it("최적성: 소규모 입력에서 완전탐색 최적값과 비교 (일치율 ≥ 95%, 차이 ≤ 1)", () => {
    const rng = createRng(31);
    const small = [
      { teamCount: 2, teamSize: 4 },
      { teamCount: 2, teamSize: 5 },
      { teamCount: 3, teamSize: 3 },
      { teamCount: 4, teamSize: 2 },
    ];
    for (const c of small) {
      let optimal = 0;
      for (let run = 0; run < RUNS; run++) {
        const grades = randomGrades(rng, c.teamCount * c.teamSize, 1, 10); // 폭을 넓혀 더 까다롭게
        const r = formTeams({ ...c, attendees: fakeMembers(grades), seed: run });
        const best = optimalSpread(grades, c.teamCount, c.teamSize);
        expect(r.spread - best).toBeLessThanOrEqual(1);
        if (r.spread === best) optimal++;
      }
      expect(optimal / RUNS, `${c.teamCount}팀×${c.teamSize}명`).toBeGreaterThanOrEqual(0.95);
    }
  });
});
