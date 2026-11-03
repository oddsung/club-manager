import { describe, expect, it } from "vitest";
import { rangeGradeScale } from "../src/grade";
import { createMemberRegistry } from "../src/members";
import { createMeetingBoard } from "../src/meetings";

// R-06 경계값·예외 보강 테스트. 가짜 데이터만 사용 (AGENTS.md 금지 사항)
const at = (iso: string) => new Date(iso);
const startsAt = at("2026-11-10T19:00:00Z");
const before = at("2026-11-05T09:00:00Z");

function setup() {
  const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
  const a = members.register({ name: "테스트회원A", grade: 3 });
  const b = members.register({ name: "테스트회원B", grade: 4 });
  const board = createMeetingBoard({ members });
  return { members, board, a, b };
}

describe("R-06 생성 경계값", () => {
  it("응답 마감 일시가 올바른 날짜가 아니면 오류", () => {
    const { board } = setup();
    expect(() => board.create({ title: "모임", startsAt, responseDeadline: at("잘못된 날짜") })).toThrow(/날짜/);
  });

  it("생성에 넘긴 Date를 나중에 바꿔도 저장된 모임은 바뀌지 않는다", () => {
    const { board } = setup();
    const input = at("2026-11-10T19:00:00Z");
    const m = board.create({ title: "모임", startsAt: input });
    input.setUTCFullYear(2000);
    expect(board.get(m.id)?.startsAt.toISOString()).toBe("2026-11-10T19:00:00.000Z");
  });

  it("고유 ID: ID 생성기가 이미 있는 ID를 주면 오류", () => {
    const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
    const board = createMeetingBoard({ members, idGenerator: () => "고정-ID" });
    board.create({ title: "모임1", startsAt });
    expect(() => board.create({ title: "모임2", startsAt })).toThrow(/ID/);
    expect(board.list()).toHaveLength(1);
  });
});

describe("R-06 수정 경계값", () => {
  it("수정 시 제목도 앞뒤 공백을 제거하고, 공백뿐이면 오류", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt });
    expect(board.update(m.id, { title: "  바뀐 모임  " }).title).toBe("바뀐 모임");
    expect(() => board.update(m.id, { title: "   " })).toThrow(/제목/);
    expect(board.get(m.id)?.title).toBe("바뀐 모임");
  });

  it("수정 시 날짜가 올바르지 않으면 오류", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt });
    expect(() => board.update(m.id, { startsAt: at("잘못된 날짜") })).toThrow(/날짜/);
    expect(() => board.update(m.id, { responseDeadline: at("잘못된 날짜") })).toThrow(/날짜/);
  });

  it("(M2-Q8) 수정으로 마감과 시작이 같아지는 것은 허용", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt, responseDeadline: at("2026-11-09T19:00:00Z") });
    const u = board.update(m.id, { startsAt: at("2026-11-09T19:00:00Z") });
    expect(u.startsAt.getTime()).toBe(u.responseDeadline?.getTime());
  });

  it("(M2-Q8) 수정 오류가 나면 기존 값이 그대로 유지된다", () => {
    const { board } = setup();
    const deadline = at("2026-11-09T19:00:00Z");
    const m = board.create({ title: "모임", startsAt, responseDeadline: deadline });
    expect(() => board.update(m.id, { title: "새 제목", startsAt: at("2026-11-08T19:00:00Z") })).toThrow(/마감/);
    const kept = board.get(m.id);
    expect(kept?.title).toBe("모임");
    expect(kept?.startsAt.toISOString()).toBe(startsAt.toISOString());
  });

  it("null 로 메모·마감을 지우고, undefined 항목은 기존 값을 유지한다", () => {
    const { board } = setup();
    const m = board.create({
      title: "모임",
      startsAt,
      location: "가짜체육관",
      memo: "가짜 메모",
      responseDeadline: at("2026-11-09T19:00:00Z"),
    });
    const u = board.update(m.id, { memo: null, responseDeadline: null });
    expect(u.memo).toBeUndefined();
    expect(u.responseDeadline).toBeUndefined();
    expect(u).toMatchObject({ id: m.id, title: "모임", location: "가짜체육관", cancelled: false });
  });

  it("수정해도 ID와 목록 순서(생성 순서)는 바뀌지 않는다", () => {
    const { board } = setup();
    const m1 = board.create({ title: "모임1", startsAt });
    const m2 = board.create({ title: "모임2", startsAt });
    board.update(m1.id, { title: "모임1-수정" });
    expect(board.list().map((m) => m.id)).toEqual([m1.id, m2.id]);
  });
});

describe("R-06 취소 경계값", () => {
  it("취소 후 조회하면 cancelled 이고 다른 항목은 그대로다", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt, location: "가짜체육관" });
    board.cancel(m.id);
    expect(board.get(m.id)).toMatchObject({ id: m.id, title: "모임", location: "가짜체육관", cancelled: true });
  });
});

describe("R-06 다가오는 모임 경계값", () => {
  it("모임이 없으면 빈 목록", () => {
    const { board } = setup();
    expect(board.upcoming(before)).toEqual([]);
  });

  it("now 보다 1ms 늦게 시작하는 모임은 포함한다", () => {
    const { board } = setup();
    board.create({ title: "곧 시작", startsAt: new Date(before.getTime() + 1) });
    expect(board.upcoming(before).map((m) => m.title)).toEqual(["곧 시작"]);
  });

  it("시작 시각을 수정하면 정렬 순서에 반영된다", () => {
    const { board } = setup();
    const m1 = board.create({ title: "모임1", startsAt: at("2026-11-10T19:00:00Z") });
    board.create({ title: "모임2", startsAt: at("2026-11-12T19:00:00Z") });
    board.update(m1.id, { startsAt: at("2026-11-14T19:00:00Z") });
    expect(board.upcoming(before).map((m) => m.title)).toEqual(["모임2", "모임1"]);
  });

  it("시작 시각을 과거로 수정하면 다가오는 목록에서 빠진다", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt });
    board.update(m.id, { startsAt: at("2026-11-01T19:00:00Z") });
    expect(board.upcoming(before)).toEqual([]);
  });
});

describe("R-06 참석 응답 경계값", () => {
  it("(M2-Q6) 마감이 시작 시각과 같으면 시작 시각의 응답도 허용", () => {
    const { board, a } = setup();
    const m = board.create({ title: "모임", startsAt, responseDeadline: startsAt });
    board.respond(m.id, a.id, "attending", startsAt);
    expect(board.summary(m.id).attending.memberIds).toEqual([a.id]);
    expect(() => board.respond(m.id, a.id, "absent", new Date(startsAt.getTime() + 1))).toThrow(/마감/);
  });

  it("(M2-Q7) 마감을 null 로 지우면 시작 시각 전까지 다시 응답 가능", () => {
    const { board, a } = setup();
    const deadline = at("2026-11-08T19:00:00Z");
    const m = board.create({ title: "모임", startsAt, responseDeadline: deadline });
    const afterDeadline = at("2026-11-09T19:00:00Z");
    expect(() => board.respond(m.id, a.id, "attending", afterDeadline)).toThrow(/마감/);
    board.update(m.id, { responseDeadline: null });
    board.respond(m.id, a.id, "attending", afterDeadline);
    expect(() => board.respond(m.id, a.id, "absent", startsAt)).toThrow(/시작/);
    expect(board.summary(m.id).attending.memberIds).toEqual([a.id]);
  });

  it("같은 응답을 반복해도 한 번만 집계된다", () => {
    const { board, a } = setup();
    const m = board.create({ title: "모임", startsAt });
    board.respond(m.id, a.id, "undecided", before);
    board.respond(m.id, a.id, "undecided", before);
    expect(board.summary(m.id).undecided).toEqual({ count: 1, memberIds: [a.id] });
  });

  it("응답을 바꿔도 회원 순서는 처음 응답한 순서를 따른다", () => {
    const { board, a, b } = setup();
    const m = board.create({ title: "모임", startsAt });
    board.respond(m.id, a.id, "undecided", before);
    board.respond(m.id, b.id, "attending", before);
    board.respond(m.id, a.id, "attending", before);
    expect(board.summary(m.id).attending.memberIds).toEqual([a.id, b.id]);
    expect(board.summary(m.id).undecided.count).toBe(0);
  });

  it("마감 이후 변경 오류가 나면 기존 응답이 유지된다", () => {
    const { board, a } = setup();
    const deadline = at("2026-11-08T19:00:00Z");
    const m = board.create({ title: "모임", startsAt, responseDeadline: deadline });
    board.respond(m.id, a.id, "attending", before);
    expect(() => board.respond(m.id, a.id, "absent", new Date(deadline.getTime() + 1))).toThrow(/마감/);
    expect(board.summary(m.id)).toEqual({
      attending: { count: 1, memberIds: [a.id] },
      absent: { count: 0, memberIds: [] },
      undecided: { count: 0, memberIds: [] },
    });
  });

  it("재활성화된 회원은 다시 응답할 수 있다", () => {
    const { members, board, a } = setup();
    const m = board.create({ title: "모임", startsAt });
    members.deactivate(a.id);
    expect(() => board.respond(m.id, a.id, "attending", before)).toThrow(/비활성/);
    members.reactivate(a.id);
    board.respond(m.id, a.id, "attending", before);
    expect(board.summary(m.id).attending.memberIds).toEqual([a.id]);
  });
});
