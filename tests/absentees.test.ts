import { describe, expect, it } from "vitest";
import { recentAbsentees } from "../src/absentees";
import { createAttendanceBook } from "../src/attendance";
import { rangeGradeScale } from "../src/grade";
import { createMeetingBoard } from "../src/meetings";
import { createMemberRegistry } from "../src/members";

// 가짜 데이터만 사용 (AGENTS.md 금지 사항)
const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-05T12:00:00Z");

function setup() {
  const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
  const a = members.register({ name: "테스트회원A", grade: 3 });
  const b = members.register({ name: "테스트회원B", grade: 4 });
  const c = members.register({ name: "테스트회원C", grade: 2 });
  const meetings = createMeetingBoard({ members });
  const attendance = createAttendanceBook(members);
  const sources = { members, meetings, attendance };
  const meet = (iso: string) => meetings.create({ title: "정기 모임", startsAt: at(iso) }).id;
  const ids = (list: { id: string }[]) => list.map((m) => m.id);
  return { members, meetings, attendance, sources, meet, ids, a, b, c };
}

describe("R-11 최근 모임 결석 회원 조회", () => {
  it("R11-1 취소된 모임·미래 모임은 제외하고 지난 모임 중 가장 최근 N개만 본다", () => {
    const { sources, meetings, attendance, meet, ids, a, b, c } = setup();
    const old = meet("2026-10-01T10:00:00Z");
    meet("2026-10-20T10:00:00Z");
    meet("2026-10-27T10:00:00Z");
    const cancelled = meet("2026-11-01T10:00:00Z");
    meetings.cancel(cancelled);
    meet("2026-11-03T10:00:00Z");
    const future = meet("2026-11-10T10:00:00Z");
    attendance.check(old, a.id); // 4번째로 오래된 모임 → 범위 밖
    attendance.check(cancelled, b.id); // 취소 모임 → 무시
    attendance.check(future, c.id); // 미래 모임 → 무시
    expect(ids(recentAbsentees(sources, NOW, 3))).toEqual([a.id, b.id, c.id]);
  });

  it("R11-1 시작 시각이 now 와 같은 모임은 지난 모임으로 본다", () => {
    const { sources, attendance, meet, ids, a, b, c } = setup();
    const m = meet("2026-11-05T12:00:00Z");
    attendance.check(m, a.id);
    expect(ids(recentAbsentees(sources, NOW, 1))).toEqual([b.id, c.id]);
  });

  it("R11-1 시작 시각이 같으면 나중에 생성된 모임을 더 최근으로 본다", () => {
    const { sources, attendance, meet, ids, a, b, c } = setup();
    const first = meet("2026-11-01T10:00:00Z");
    const second = meet("2026-11-01T10:00:00Z");
    attendance.check(first, a.id);
    attendance.check(second, b.id);
    expect(ids(recentAbsentees(sources, NOW, 1))).toEqual([a.id, c.id]);
  });

  it("R11-2 회수를 생략하면 3회를 본다", () => {
    const { sources, attendance, meet, ids, a, b, c } = setup();
    const m1 = meet("2026-10-01T10:00:00Z");
    const m2 = meet("2026-10-08T10:00:00Z");
    meet("2026-10-15T10:00:00Z");
    meet("2026-10-22T10:00:00Z");
    attendance.check(m1, a.id); // 4회 전 → 범위 밖
    attendance.check(m2, b.id); // 3회 전 → 범위 안
    expect(ids(recentAbsentees(sources, NOW))).toEqual([a.id, c.id]);
  });

  it("R11-2 회수가 1 미만이거나 정수가 아니면 오류", () => {
    const { sources } = setup();
    for (const n of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => recentAbsentees(sources, NOW, n)).toThrow("1 이상의 정수");
    }
  });

  it("R11-2 유효하지 않은 now 는 오류", () => {
    const { sources } = setup();
    expect(() => recentAbsentees(sources, new Date("invalid"))).toThrow("올바른 날짜가 아닙니다");
  });

  it("R11-3 지난 모임이 N회보다 적으면 있는 모임 모두 결석한 회원", () => {
    const { sources, attendance, meet, ids, a, b, c } = setup();
    const m1 = meet("2026-10-20T10:00:00Z");
    meet("2026-10-27T10:00:00Z");
    attendance.check(m1, b.id);
    expect(ids(recentAbsentees(sources, NOW, 3))).toEqual([a.id, c.id]);
  });

  it("R11-3 지난 모임이 0회면 빈 목록 (오류 아님)", () => {
    const { sources, meetings, meet } = setup();
    meet("2026-11-10T10:00:00Z");
    meetings.cancel(meet("2026-11-01T10:00:00Z"));
    expect(recentAbsentees(sources, NOW)).toEqual([]);
  });

  it("R11-4 비활성 회원은 결석이어도 제외한다", () => {
    const { sources, members, meet, ids, a, c } = setup();
    meet("2026-11-01T10:00:00Z");
    members.deactivate(a.id);
    expect(ids(recentAbsentees(sources, NOW))).not.toContain(a.id);
    expect(ids(recentAbsentees(sources, NOW))).toContain(c.id);
  });

  it("R11-5 모임 이후 가입한 회원도 결석으로 포함된다 (알려진 한계)", () => {
    const { sources, members, meet, ids } = setup();
    meet("2026-11-01T10:00:00Z");
    const late = members.register({ name: "테스트회원D", grade: 1 });
    expect(ids(recentAbsentees(sources, NOW))).toContain(late.id);
  });

  it("R11-6 참석 응답만 하고 출석 체크가 없으면 결석", () => {
    const { sources, meetings, attendance, meet, ids, a, b, c } = setup();
    const m = meet("2026-11-01T10:00:00Z");
    meetings.respond(m, a.id, "attending", at("2026-10-30T00:00:00Z"));
    attendance.check(m, b.id);
    expect(ids(recentAbsentees(sources, NOW))).toEqual([a.id, c.id]);
  });

  it("R11-7 결과는 Member 목록, 회원 등록 순서", () => {
    const { sources, meet, a, b, c } = setup();
    meet("2026-11-01T10:00:00Z");
    expect(recentAbsentees(sources, NOW)).toEqual([a, b, c]);
  });

  it("R11-8 필요한 메서드만 가진 의존(Pick)으로도 동작한다", () => {
    const { members, meetings, attendance, meet, ids, a, b, c } = setup();
    const m = meet("2026-11-01T10:00:00Z");
    attendance.check(m, b.id);
    const minimal = {
      members: { list: () => members.list() },
      meetings: { list: () => meetings.list() },
      attendance: { isChecked: (mt: string, mb: string) => attendance.isChecked(mt, mb) },
    };
    expect(ids(recentAbsentees(minimal, NOW))).toEqual([a.id, c.id]);
  });
});
