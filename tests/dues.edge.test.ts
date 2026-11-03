import { describe, expect, it } from "vitest";
import { createDuesLedger } from "../src/dues";
import { rangeGradeScale } from "../src/grade";
import { createMemberRegistry } from "../src/members";

// R-05 경계값·예외 보강 테스트. 가짜 데이터만 사용 (AGENTS.md 금지 사항)
const FEE = 30000;
const PAID_AT = new Date("2026-11-04T10:00:00+09:00");

function setup() {
  const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
  const a = members.register({ name: "가짜회원A", grade: 3 });
  const b = members.register({ name: "가짜회원B", grade: 2 });
  const ledger = createDuesLedger({ members, monthlyFee: FEE });
  const pay = (memberId: string, month = "2026-11", paidAt = PAID_AT) =>
    ledger.recordPayment({ memberId, month, amount: FEE, paidAt });
  return { members, ledger, a, b, pay };
}

describe("R-05 회비 납부 — 경계값·예외", () => {
  it("월 회비가 NaN·Infinity 이면 오류", () => {
    const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
    expect(() => createDuesLedger({ members, monthlyFee: Number.NaN })).toThrow(/월 회비/);
    expect(() => createDuesLedger({ members, monthlyFee: Number.POSITIVE_INFINITY })).toThrow(/월 회비/);
  });

  it("월 회비가 1원(최소 양의 정수)이면 허용된다", () => {
    const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
    const a = members.register({ name: "가짜회원A", grade: 1 });
    const ledger = createDuesLedger({ members, monthlyFee: 1 });
    ledger.recordPayment({ memberId: a.id, month: "2026-11", amount: 1, paidAt: PAID_AT });
    expect(ledger.totalForMonth("2026-11")).toBe(1);
  });

  it("대상 월 경계: 01월·12월은 허용, 연도가 바뀌어도 월별로 독립", () => {
    const { ledger, a, pay } = setup();
    pay(a.id, "2026-12");
    pay(a.id, "2027-01");
    expect(ledger.totalForMonth("2026-12")).toBe(FEE);
    expect(ledger.totalForMonth("2027-01")).toBe(FEE);
    expect(ledger.unpaidMembers("2027-01").map((m) => m.id)).not.toContain(a.id);
  });

  it("대상 월 형식 오류: 앞뒤 공백·일자 포함·문자 연도는 거부", () => {
    const { ledger, a, pay } = setup();
    for (const bad of [" 2026-11", "2026-11 ", "2026-11-01", "abcd-11", "26-11", "2026-011"]) {
      expect(() => pay(a.id, bad)).toThrow(/YYYY-MM/);
    }
    expect(() => ledger.paymentsForMonth("2026-1")).toThrow(/YYYY-MM/);
  });

  it("오류가 난 납부 시도는 아무것도 기록하지 않는다", () => {
    const { members, ledger, a, b, pay } = setup();
    expect(() => ledger.recordPayment({ memberId: a.id, month: "2026-11", amount: FEE - 1, paidAt: PAID_AT })).toThrow();
    ledger.setExempt(a.id);
    expect(() => pay(a.id)).toThrow(/면제/);
    members.deactivate(b.id);
    expect(() => pay(b.id)).toThrow(/비활성/);
    expect(ledger.paymentsForMonth("2026-11")).toEqual([]);
    expect(ledger.totalForMonth("2026-11")).toBe(0);
  });

  it("중복 판단은 회원·월 기준: 납부 시각이 달라도 같은 월이면 오류", () => {
    const { ledger, a, pay } = setup();
    pay(a.id, "2026-11");
    expect(() => pay(a.id, "2026-11", new Date("2026-11-30T23:59:59+09:00"))).toThrow(/이미 납부/);
    expect(ledger.paymentsForMonth("2026-11")).toHaveLength(1);
  });

  it("면제 해제 후에는 납부할 수 있고 미납자 목록에 다시 포함된다 (M2-Q5)", () => {
    const { ledger, a, pay } = setup();
    ledger.setExempt(a.id);
    expect(ledger.unpaidMembers("2026-11").map((m) => m.id)).not.toContain(a.id);
    ledger.clearExempt(a.id);
    expect(ledger.unpaidMembers("2026-11").map((m) => m.id)).toContain(a.id);
    expect(() => pay(a.id)).not.toThrow();
  });

  it("면제는 회원 단위라 모든 월에 적용된다 (M2-Q5)", () => {
    const { ledger, a, pay } = setup();
    ledger.setExempt(a.id);
    for (const month of ["2026-01", "2026-11", "2027-06"]) {
      expect(ledger.unpaidMembers(month).map((m) => m.id)).not.toContain(a.id);
      expect(() => pay(a.id, month)).toThrow(/면제/);
    }
  });

  it("없는 회원의 면제 해제는 오류", () => {
    const { ledger } = setup();
    expect(() => ledger.clearExempt("없는-ID")).toThrow(/회원을 찾을 수 없습니다/);
  });

  it("재활성화된 회원은 납부할 수 있다 (M2-Q3·Q4: 시점 기준)", () => {
    const { members, ledger, b, pay } = setup();
    members.deactivate(b.id);
    expect(() => pay(b.id)).toThrow(/비활성/);
    members.reactivate(b.id);
    expect(() => pay(b.id)).not.toThrow();
    expect(ledger.unpaidMembers("2026-11").map((m) => m.id)).not.toContain(b.id);
  });

  it("장부 생성 후 등록된 회원도 미납자 목록·납부 대상이 된다 (조회 시점 기준)", () => {
    const { members, ledger, a, b, pay } = setup();
    const late = members.register({ name: "가짜회원C", grade: 4 });
    expect(ledger.unpaidMembers("2026-11").map((m) => m.id)).toEqual([a.id, b.id, late.id]);
    pay(late.id);
    expect(ledger.unpaidMembers("2026-11").map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it("월별 납부 기록은 다른 월 기록이 섞여도 기록 순서를 유지한다", () => {
    const { ledger, a, b, pay } = setup();
    pay(b.id, "2026-11");
    pay(a.id, "2026-12");
    pay(a.id, "2026-11");
    expect(ledger.paymentsForMonth("2026-11").map((p) => p.memberId)).toEqual([b.id, a.id]);
    expect(ledger.paymentsForMonth("2026-12").map((p) => p.memberId)).toEqual([a.id]);
  });

  it("납부 후 입력 Date 를 바꿔도 저장된 납부 시각은 바뀌지 않는다", () => {
    const { ledger, a } = setup();
    const input = new Date(PAID_AT.getTime());
    ledger.recordPayment({ memberId: a.id, month: "2026-11", amount: FEE, paidAt: input });
    input.setFullYear(2000);
    expect(ledger.paymentsForMonth("2026-11")[0]?.paidAt.getTime()).toBe(PAID_AT.getTime());
  });
});
