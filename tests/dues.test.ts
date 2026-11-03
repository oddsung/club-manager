import { describe, expect, it } from "vitest";
import { createDuesLedger } from "../src/dues";
import { rangeGradeScale } from "../src/grade";
import { createMemberRegistry } from "../src/members";

// 가짜 데이터만 사용 (AGENTS.md 금지 사항)
const FEE = 30000;
const PAID_AT = new Date("2026-11-04T10:00:00+09:00");

function setup() {
  const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
  const a = members.register({ name: "테스트회원A", grade: 3 });
  const b = members.register({ name: "테스트회원B", grade: 2 });
  const c = members.register({ name: "테스트회원C", grade: 4 });
  const ledger = createDuesLedger({ members, monthlyFee: FEE });
  const pay = (memberId: string, month = "2026-11", amount = FEE) =>
    ledger.recordPayment({ memberId, month, amount, paidAt: PAID_AT });
  return { members, ledger, a, b, c, pay };
}

describe("R-05 회비 납부", () => {
  it("월 회비는 설정값으로 주입되며 원 단위 양의 정수여야 한다", () => {
    const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
    expect(createDuesLedger({ members, monthlyFee: FEE }).monthlyFee).toBe(FEE);
    expect(() => createDuesLedger({ members, monthlyFee: 0 })).toThrow(/월 회비/);
    expect(() => createDuesLedger({ members, monthlyFee: -1000 })).toThrow(/월 회비/);
    expect(() => createDuesLedger({ members, monthlyFee: 1000.5 })).toThrow(/월 회비/);
  });

  it("납부 기록: 회원, 대상 월, 금액, 주입된 납부 시각이 저장된다", () => {
    const { ledger, a, pay } = setup();
    const p = pay(a.id);
    expect(p).toEqual({ memberId: a.id, month: "2026-11", amount: FEE, paidAt: PAID_AT });
    expect(ledger.paymentsForMonth("2026-11")).toEqual([p]);
  });

  it("금액이 월 회비와 다르면 오류 (부분 납부 없음)", () => {
    const { a, pay } = setup();
    expect(() => pay(a.id, "2026-11", FEE - 1)).toThrow(/금액/);
    expect(() => pay(a.id, "2026-11", FEE + 1)).toThrow(/금액/);
  });

  it("같은 회원·같은 월 중복 납부는 오류, 다른 월은 가능", () => {
    const { a, pay } = setup();
    pay(a.id, "2026-11");
    expect(() => pay(a.id, "2026-11")).toThrow(/이미 납부/);
    expect(() => pay(a.id, "2026-12")).not.toThrow();
  });

  it("대상 월은 YYYY-MM 형식이어야 한다", () => {
    const { ledger, a, pay } = setup();
    for (const bad of ["2026-13", "2026-00", "2026-1", "202611", "2026/11", ""]) {
      expect(() => pay(a.id, bad)).toThrow(/YYYY-MM/);
    }
    expect(() => ledger.unpaidMembers("2026-13")).toThrow(/YYYY-MM/);
    expect(() => ledger.totalForMonth("11-2026")).toThrow(/YYYY-MM/);
  });

  it("없는 회원은 납부·면제 지정 모두 오류", () => {
    const { ledger, pay } = setup();
    expect(() => pay("없는-ID")).toThrow(/회원을 찾을 수 없습니다/);
    expect(() => ledger.setExempt("없는-ID")).toThrow(/회원을 찾을 수 없습니다/);
  });

  it("잘못된 납부 시각은 오류", () => {
    const { ledger, a } = setup();
    expect(() =>
      ledger.recordPayment({ memberId: a.id, month: "2026-11", amount: FEE, paidAt: new Date("invalid") }),
    ).toThrow(/납부 시각/);
  });

  it("회원 단위로 면제를 지정·해제할 수 있다 (M2-Q5)", () => {
    const { ledger, a } = setup();
    expect(ledger.isExempt(a.id)).toBe(false);
    ledger.setExempt(a.id);
    expect(ledger.isExempt(a.id)).toBe(true);
    expect(() => ledger.setExempt(a.id)).toThrow(/이미 회비 면제/);
    ledger.clearExempt(a.id);
    expect(ledger.isExempt(a.id)).toBe(false);
    expect(() => ledger.clearExempt(a.id)).toThrow(/면제가 아닌/);
  });

  it("면제 회원·비활성 회원의 납부는 오류 (M2-Q4)", () => {
    const { members, ledger, a, b, pay } = setup();
    ledger.setExempt(a.id);
    expect(() => pay(a.id)).toThrow(/면제/);
    members.deactivate(b.id);
    expect(() => pay(b.id)).toThrow(/비활성/);
  });

  it("미납자 목록: 활성·비면제·납부 기록 없는 회원 (등록 순)", () => {
    const { ledger, a, b, c, pay } = setup();
    expect(ledger.unpaidMembers("2026-11").map((m) => m.id)).toEqual([a.id, b.id, c.id]);
    pay(a.id);
    ledger.setExempt(c.id);
    expect(ledger.unpaidMembers("2026-11").map((m) => m.id)).toEqual([b.id]);
    // 다른 월은 독립
    expect(ledger.unpaidMembers("2026-12").map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it("미납자 판단은 조회 시점의 활성 여부 기준 (M2-Q3)", () => {
    const { members, ledger, a, b, c } = setup();
    members.deactivate(b.id);
    expect(ledger.unpaidMembers("2026-10").map((m) => m.id)).toEqual([a.id, c.id]);
    members.reactivate(b.id);
    expect(ledger.unpaidMembers("2026-10").map((m) => m.id)).toEqual([a.id, b.id, c.id]);
  });

  it("월별 납부 합계를 조회할 수 있다", () => {
    const { ledger, a, b, pay } = setup();
    expect(ledger.totalForMonth("2026-11")).toBe(0);
    pay(a.id, "2026-11");
    pay(b.id, "2026-11");
    pay(a.id, "2026-12");
    expect(ledger.totalForMonth("2026-11")).toBe(FEE * 2);
    expect(ledger.totalForMonth("2026-12")).toBe(FEE);
  });

  it("반환된 납부 기록은 변경할 수 없다", () => {
    const { a, pay } = setup();
    expect(Object.isFrozen(pay(a.id))).toBe(true);
  });
});
