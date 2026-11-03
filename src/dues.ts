// R-05: 회비 납부 관리 (메모리 내 저장소).
import type { Member, MemberRegistry } from "./members";

/** 대상 월. YYYY-MM 형식 (예: "2026-11"). */
export type YearMonth = string;

export interface DuesPayment {
  readonly memberId: string;
  readonly month: YearMonth;
  /** 원 단위 정수. 월 회비와 같다. */
  readonly amount: number;
  /** 납부 시각 (주입). */
  readonly paidAt: Date;
}

export interface NewDuesPayment {
  memberId: string;
  month: YearMonth;
  amount: number;
  paidAt: Date;
}

export interface DuesLedgerOptions {
  members: MemberRegistry;
  /** 월 회비 (정액, 원 단위 양의 정수). */
  monthlyFee: number;
}

export interface DuesLedger {
  readonly monthlyFee: number;
  /** 회원 단위 면제 지정 (M2-Q5). 이미 면제면 오류. */
  setExempt(memberId: string): void;
  /** 면제 해제. 면제가 아니면 오류. */
  clearExempt(memberId: string): void;
  isExempt(memberId: string): boolean;
  /** 납부 기록. 면제·비활성 회원(M2-Q4), 금액 불일치, 같은 회원·같은 월 중복은 오류. */
  recordPayment(input: NewDuesPayment): DuesPayment;
  /** 해당 월 납부 기록 (기록 순). */
  paymentsForMonth(month: YearMonth): DuesPayment[];
  /** 미납자: 조회 시점 활성(M2-Q3)·비면제·해당 월 납부 기록 없음. 회원 등록 순. */
  unpaidMembers(month: YearMonth): Member[];
  /** 해당 월 납부 합계 (원). */
  totalForMonth(month: YearMonth): number;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function validMonth(month: string): YearMonth {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error(`대상 월은 YYYY-MM 형식이어야 합니다: ${month}`);
  }
  return month;
}

export function createDuesLedger(options: DuesLedgerOptions): DuesLedger {
  const { members, monthlyFee } = options;
  if (!Number.isInteger(monthlyFee) || monthlyFee <= 0) {
    throw new Error(`월 회비는 원 단위 양의 정수여야 합니다: ${monthlyFee}`);
  }
  const exempt = new Set<string>();
  const payments: DuesPayment[] = [];

  function mustGetMember(id: string): Member {
    const m = members.get(id);
    if (!m) throw new Error(`회원을 찾을 수 없습니다: ${id}`);
    return m;
  }

  function paymentsOf(month: string): DuesPayment[] {
    const valid = validMonth(month);
    return payments.filter((p) => p.month === valid);
  }

  return {
    monthlyFee,
    setExempt(memberId) {
      mustGetMember(memberId);
      if (exempt.has(memberId)) throw new Error(`이미 회비 면제인 회원입니다: ${memberId}`);
      exempt.add(memberId);
    },
    clearExempt(memberId) {
      mustGetMember(memberId);
      if (!exempt.has(memberId)) throw new Error(`회비 면제가 아닌 회원입니다: ${memberId}`);
      exempt.delete(memberId);
    },
    isExempt: (memberId) => exempt.has(memberId),
    recordPayment(input) {
      const member = mustGetMember(input.memberId);
      const month = validMonth(input.month);
      if (!member.active) throw new Error(`비활성 회원은 회비를 납부할 수 없습니다: ${member.id}`);
      if (exempt.has(member.id)) throw new Error(`회비 면제 회원은 납부할 수 없습니다: ${member.id}`);
      if (input.amount !== monthlyFee) {
        throw new Error(`납부 금액은 월 회비(${monthlyFee}원)와 같아야 합니다: ${input.amount}`);
      }
      if (!(input.paidAt instanceof Date) || Number.isNaN(input.paidAt.getTime())) {
        throw new Error("납부 시각이 올바르지 않습니다.");
      }
      if (payments.some((p) => p.memberId === member.id && p.month === month)) {
        throw new Error(`이미 납부한 월입니다: ${member.id} ${month}`);
      }
      const payment: DuesPayment = Object.freeze({
        memberId: member.id,
        month,
        amount: input.amount,
        paidAt: new Date(input.paidAt.getTime()),
      });
      payments.push(payment);
      return payment;
    },
    paymentsForMonth: paymentsOf,
    unpaidMembers(month) {
      const paid = new Set(paymentsOf(month).map((p) => p.memberId));
      return members.list().filter((m) => !exempt.has(m.id) && !paid.has(m.id));
    },
    totalForMonth(month) {
      return paymentsOf(month).reduce((sum, p) => sum + p.amount, 0);
    },
  };
}
