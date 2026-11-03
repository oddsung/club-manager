import { describe, expect, it } from "vitest";
import { createAttendanceBook } from "../src/attendance";
import { rangeGradeScale } from "../src/grade";
import { createMemberRegistry } from "../src/members";
import { formTeams } from "../src/teams";

// 가짜 데이터만 사용 (AGENTS.md 금지 사항)
function setup() {
  const registry = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
  const a = registry.register({ name: "테스트회원A", grade: 3 });
  const b = registry.register({ name: "테스트회원B", grade: 4 });
  const c = registry.register({ name: "테스트회원C", grade: 2 });
  const book = createAttendanceBook(registry);
  return { registry, book, a, b, c };
}

describe("R-04 출석 체크", () => {
  it("모임 단위로 출석을 체크하고 취소할 수 있다", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    expect(book.isChecked("mt-1", a.id)).toBe(true);
    expect(book.isChecked("mt-2", a.id)).toBe(false);
    book.uncheck("mt-1", a.id);
    expect(book.isChecked("mt-1", a.id)).toBe(false);
    expect(book.attendees("mt-1")).toEqual([]);
  });

  it("같은 모임에 같은 회원을 두 번 체크하면 오류", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    expect(() => book.check("mt-1", a.id)).toThrow(/이미 출석/);
    // 다른 모임에는 체크할 수 있다
    expect(() => book.check("mt-2", a.id)).not.toThrow();
  });

  it("체크되지 않은 회원을 취소하면 오류 (취소 후 다시 취소해도 오류)", () => {
    const { book, a } = setup();
    expect(() => book.uncheck("mt-1", a.id)).toThrow(/체크되지 않은/);
    book.check("mt-1", a.id);
    book.uncheck("mt-1", a.id);
    expect(() => book.uncheck("mt-1", a.id)).toThrow(/체크되지 않은/);
  });

  it("취소한 뒤에는 다시 체크할 수 있다", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    book.uncheck("mt-1", a.id);
    book.check("mt-1", a.id);
    expect(book.isChecked("mt-1", a.id)).toBe(true);
  });

  it("비활성 회원은 출석 체크할 수 없다", () => {
    const { registry, book, a } = setup();
    registry.deactivate(a.id);
    expect(() => book.check("mt-1", a.id)).toThrow(/비활성/);
    expect(book.isChecked("mt-1", a.id)).toBe(false);
  });

  it("없는 회원은 체크·취소·이력·출석률 모두 오류", () => {
    const { book } = setup();
    expect(() => book.check("mt-1", "없는-ID")).toThrow(/회원을 찾을 수 없/);
    expect(() => book.uncheck("mt-1", "없는-ID")).toThrow(/회원을 찾을 수 없/);
    expect(() => book.history("없는-ID")).toThrow(/회원을 찾을 수 없/);
    expect(() => book.attendanceRate("없는-ID", ["mt-1"])).toThrow(/회원을 찾을 수 없/);
  });

  it("모임 ID가 비어 있으면 오류", () => {
    const { book, a } = setup();
    expect(() => book.check("", a.id)).toThrow(/모임 ID/);
    expect(() => book.check("  ", a.id)).toThrow(/모임 ID/);
    expect(() => book.attendees("")).toThrow(/모임 ID/);
    expect(() => book.attendanceRate(a.id, [""])).toThrow(/모임 ID/);
  });
});

describe("R-04 모임별 출석자 목록", () => {
  it("체크한 순서대로 회원 목록을 반환한다", () => {
    const { book, a, b, c } = setup();
    book.check("mt-1", b.id);
    book.check("mt-1", a.id);
    book.check("mt-2", c.id);
    expect(book.attendees("mt-1").map((m) => m.id)).toEqual([b.id, a.id]);
    expect(book.attendees("mt-2").map((m) => m.id)).toEqual([c.id]);
    expect(book.attendees("체크-없는-모임")).toEqual([]);
  });

  it("회원 정보는 조회 시점의 최신 값이다", () => {
    const { registry, book, a } = setup();
    book.check("mt-1", a.id);
    registry.changeGrade(a.id, 5);
    expect(book.attendees("mt-1")[0]).toMatchObject({ id: a.id, grade: 5 });
  });

  it("(M2-Q2) 체크 후 비활성화된 회원은 출석자 목록에서 제외, 재활성화하면 다시 포함", () => {
    const { registry, book, a, b } = setup();
    book.check("mt-1", a.id);
    book.check("mt-1", b.id);
    registry.deactivate(a.id);
    expect(book.attendees("mt-1").map((m) => m.id)).toEqual([b.id]);
    registry.reactivate(a.id);
    expect(book.attendees("mt-1").map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it("(M2-Q2) 비활성 회원도 체크 취소는 할 수 있다", () => {
    const { registry, book, a } = setup();
    book.check("mt-1", a.id);
    registry.deactivate(a.id);
    book.uncheck("mt-1", a.id);
    expect(book.isChecked("mt-1", a.id)).toBe(false);
    expect(book.history(a.id)).toEqual([]);
  });

  it("출석자 목록을 R-03 팀 편성 참석자 목록으로 그대로 쓸 수 있다", () => {
    const { registry, book, a, b, c } = setup();
    const d = registry.register({ name: "테스트회원D", grade: 1 });
    for (const m of [a, b, c, d]) book.check("mt-1", m.id);
    const result = formTeams({ attendees: book.attendees("mt-1"), teamCount: 2, teamSize: 2, seed: 1 });
    const placed = result.teams.flatMap((t) => t.members.map((m) => m.id));
    expect(placed.sort()).toEqual([a.id, b.id, c.id, d.id].sort());
    expect(result.waiting).toEqual([]);
  });
});

describe("R-04 출석 이력과 출석률", () => {
  it("회원별 출석 이력은 체크한 모임 ID 목록 (취소한 모임 제외)", () => {
    const { book, a, b } = setup();
    book.check("mt-1", a.id);
    book.check("mt-2", a.id);
    book.check("mt-3", a.id);
    book.uncheck("mt-2", a.id);
    expect(book.history(a.id)).toEqual(["mt-1", "mt-3"]);
    expect(book.history(b.id)).toEqual([]);
  });

  it("비활성 회원도 이력은 조회할 수 있다", () => {
    const { registry, book, a } = setup();
    book.check("mt-1", a.id);
    registry.deactivate(a.id);
    expect(book.history(a.id)).toEqual(["mt-1"]);
  });

  it("출석률 = 주어진 모임 중 출석한 비율", () => {
    const { book, a, b } = setup();
    book.check("mt-1", a.id);
    book.check("mt-3", a.id);
    book.check("mt-9", a.id); // 대상 목록 밖의 출석은 계산에 영향 없음
    const meetings = ["mt-1", "mt-2", "mt-3", "mt-4"];
    expect(book.attendanceRate(a.id, meetings)).toBe(0.5);
    expect(book.attendanceRate(b.id, meetings)).toBe(0);
    expect(book.attendanceRate(a.id, ["mt-1", "mt-3"])).toBe(1);
  });

  it("(M2-Q1) 대상 모임 목록이 비어 있으면 0", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    expect(book.attendanceRate(a.id, [])).toBe(0);
  });

  it("대상 모임 목록에 같은 ID가 중복되면 오류", () => {
    const { book, a } = setup();
    expect(() => book.attendanceRate(a.id, ["mt-1", "mt-1"])).toThrow(/중복/);
  });
});
