// R-04 출석 체크 경계값·예외 보강 테스트.
// 기존 tests/attendance.test.ts 가 다루지 않는 경우만 모았다.
import { describe, expect, it } from "vitest";
import { createAttendanceBook } from "../src/attendance";
import { rangeGradeScale } from "../src/grade";
import { createMemberRegistry } from "../src/members";

// 가짜 데이터만 사용 (AGENTS.md 금지 사항)
function setup() {
  const registry = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
  const a = registry.register({ name: "가짜회원A", grade: 3 });
  const b = registry.register({ name: "가짜회원B", grade: 4 });
  const c = registry.register({ name: "가짜회원C", grade: 2 });
  const book = createAttendanceBook(registry);
  return { registry, book, a, b, c };
}

describe("R-04 실패한 체크·취소는 상태를 바꾸지 않는다", () => {
  it("중복 체크 오류 후에도 출석자 목록·이력에 한 번만 남는다", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    expect(() => book.check("mt-1", a.id)).toThrow(/이미 출석/);
    expect(book.attendees("mt-1").map((m) => m.id)).toEqual([a.id]);
    expect(book.history(a.id)).toEqual(["mt-1"]);
  });

  it("비활성 회원 체크 오류는 출석자 목록·이력에 남지 않는다", () => {
    const { registry, book, a } = setup();
    registry.deactivate(a.id);
    expect(() => book.check("mt-1", a.id)).toThrow(/비활성/);
    expect(book.history(a.id)).toEqual([]);
    // 재활성화해도 실패했던 체크가 되살아나지 않는다
    registry.reactivate(a.id);
    expect(book.attendees("mt-1")).toEqual([]);
  });

  it("체크되지 않은 회원 취소 오류는 다른 회원의 체크에 영향이 없다", () => {
    const { book, a, b } = setup();
    book.check("mt-1", a.id);
    expect(() => book.uncheck("mt-1", b.id)).toThrow(/체크되지 않은/);
    expect(book.isChecked("mt-1", a.id)).toBe(true);
  });

  it("다른 모임에서 체크한 회원을 이 모임에서 취소하면 오류", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    expect(() => book.uncheck("mt-2", a.id)).toThrow(/체크되지 않은/);
    expect(book.isChecked("mt-1", a.id)).toBe(true);
  });
});

describe("R-04 취소의 범위", () => {
  it("한 회원의 취소는 같은 모임의 다른 회원과 같은 회원의 다른 모임에 영향이 없다", () => {
    const { book, a, b } = setup();
    book.check("mt-1", a.id);
    book.check("mt-1", b.id);
    book.check("mt-2", a.id);
    book.uncheck("mt-1", a.id);
    expect(book.attendees("mt-1").map((m) => m.id)).toEqual([b.id]);
    expect(book.history(a.id)).toEqual(["mt-2"]);
    expect(book.isChecked("mt-2", a.id)).toBe(true);
  });

  it("취소 후 다시 체크하면 체크한 순서상 맨 뒤가 된다 (출석자 목록·이력 모두)", () => {
    const { book, a, b, c } = setup();
    book.check("mt-1", a.id);
    book.check("mt-1", b.id);
    book.check("mt-1", c.id);
    book.uncheck("mt-1", a.id);
    book.check("mt-1", a.id);
    expect(book.attendees("mt-1").map((m) => m.id)).toEqual([b.id, c.id, a.id]);

    book.check("mt-2", a.id);
    book.uncheck("mt-1", a.id);
    book.check("mt-1", a.id);
    expect(book.history(a.id)).toEqual(["mt-2", "mt-1"]);
  });
});

describe("R-04 모임 ID 필수 (공백 포함)", () => {
  it("취소할 때 모임 ID가 비어 있거나 공백뿐이면 오류", () => {
    const { book, a } = setup();
    expect(() => book.uncheck("", a.id)).toThrow(/모임 ID/);
    expect(() => book.uncheck("   ", a.id)).toThrow(/모임 ID/);
  });

  it("출석자 목록 조회 시 공백뿐인 모임 ID는 오류", () => {
    const { book } = setup();
    expect(() => book.attendees("  ")).toThrow(/모임 ID/);
  });

  it("출석률 대상 목록 중 하나라도 공백뿐인 모임 ID가 있으면 오류", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    expect(() => book.attendanceRate(a.id, ["mt-1", " "])).toThrow(/모임 ID/);
  });

  it("(M2-Q13) 체크 여부 조회 시 모임 ID가 비어 있거나 공백뿐이면 오류", () => {
    const { book, a } = setup();
    expect(() => book.isChecked("", a.id)).toThrow(/모임 ID/);
    expect(() => book.isChecked("   ", a.id)).toThrow(/모임 ID/);
  });
});

describe("(M2-Q12) 비활성 회원의 출석률", () => {
  it("체크 후 비활성화된 회원도 출석률을 평소처럼 계산한다", () => {
    const { registry, book, a } = setup();
    book.check("mt-1", a.id);
    registry.deactivate(a.id);
    expect(book.attendanceRate(a.id, ["mt-1", "mt-2"])).toBe(0.5);
  });

  it("출석 기록이 없는 비활성 회원도 오류 없이 0", () => {
    const { registry, book, b } = setup();
    registry.deactivate(b.id);
    expect(book.attendanceRate(b.id, ["mt-1", "mt-2"])).toBe(0);
    expect(book.attendanceRate(b.id, [])).toBe(0);
  });
});

describe("(M2-Q2) 체크 후 비활성화", () => {
  it("출석자 목록에서는 빠지지만 체크 상태는 유지되어 취소할 수 있다", () => {
    const { registry, book, a } = setup();
    book.check("mt-1", a.id);
    registry.deactivate(a.id);
    expect(book.attendees("mt-1")).toEqual([]);
    expect(book.isChecked("mt-1", a.id)).toBe(true);
    // 체크된 상태이므로 다시 체크는 비활성 오류
    expect(() => book.check("mt-1", a.id)).toThrow(/비활성/);
  });

  it("모든 출석자가 비활성화되면 출석자 목록은 빈 배열", () => {
    const { registry, book, a, b } = setup();
    book.check("mt-1", a.id);
    book.check("mt-1", b.id);
    registry.deactivate(a.id);
    registry.deactivate(b.id);
    expect(book.attendees("mt-1")).toEqual([]);
  });

  it("비활성 상태에서 취소한 뒤 재활성화하면 출석자 목록에 다시 나오지 않는다", () => {
    const { registry, book, a, b } = setup();
    book.check("mt-1", a.id);
    book.check("mt-1", b.id);
    registry.deactivate(a.id);
    book.uncheck("mt-1", a.id);
    registry.reactivate(a.id);
    expect(book.attendees("mt-1").map((m) => m.id)).toEqual([b.id]);
  });
});

describe("R-04 출석률 경계값", () => {
  it("나누어 떨어지지 않는 비율도 출석 수 / 모임 수 그대로 계산한다", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    expect(book.attendanceRate(a.id, ["mt-1", "mt-2", "mt-3"])).toBeCloseTo(1 / 3, 10);
    book.check("mt-2", a.id);
    expect(book.attendanceRate(a.id, ["mt-1", "mt-2", "mt-3"])).toBeCloseTo(2 / 3, 10);
  });

  it("모임 하나만 대상이면 0 또는 1", () => {
    const { book, a } = setup();
    expect(book.attendanceRate(a.id, ["mt-1"])).toBe(0);
    book.check("mt-1", a.id);
    expect(book.attendanceRate(a.id, ["mt-1"])).toBe(1);
  });

  it("취소한 모임은 출석률에 포함되지 않는다", () => {
    const { book, a } = setup();
    book.check("mt-1", a.id);
    book.check("mt-2", a.id);
    book.uncheck("mt-2", a.id);
    expect(book.attendanceRate(a.id, ["mt-1", "mt-2"])).toBe(0.5);
  });

  it("(M2-Q1) 출석 기록이 전혀 없는 회원도 빈 목록이면 0", () => {
    const { book, b } = setup();
    expect(book.attendanceRate(b.id, [])).toBe(0);
  });

  it("(M2-Q9) 떨어져 있는 중복 ID도 오류 (출석 여부와 무관)", () => {
    const { book, a, b } = setup();
    book.check("mt-1", a.id);
    expect(() => book.attendanceRate(a.id, ["mt-1", "mt-2", "mt-1"])).toThrow(/중복/);
    expect(() => book.attendanceRate(b.id, ["mt-2", "mt-3", "mt-2"])).toThrow(/중복/);
  });
});
