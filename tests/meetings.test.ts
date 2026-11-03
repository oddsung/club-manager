import { describe, expect, it } from "vitest";
import { rangeGradeScale } from "../src/grade";
import { createMemberRegistry } from "../src/members";
import { createMeetingBoard } from "../src/meetings";

// 가짜 데이터만 사용 (AGENTS.md 금지 사항)
const at = (iso: string) => new Date(iso);

function setup() {
  const members = createMemberRegistry({ scale: rangeGradeScale(1, 5) });
  const a = members.register({ name: "테스트회원A", grade: 3 });
  const b = members.register({ name: "테스트회원B", grade: 4 });
  const c = members.register({ name: "테스트회원C", grade: 2 });
  const board = createMeetingBoard({ members });
  return { members, board, a, b, c };
}

describe("R-06 모임 생성", () => {
  it("제목·시작 일시만으로 생성하면 고유 ID가 부여되고 취소되지 않은 상태다", () => {
    const { board } = setup();
    const m1 = board.create({ title: " 정기 모임 ", startsAt: at("2026-11-10T19:00:00Z") });
    const m2 = board.create({ title: "번개 모임", startsAt: at("2026-11-11T19:00:00Z") });
    expect(m1.id).not.toBe(m2.id);
    expect(m1).toMatchObject({ title: "정기 모임", cancelled: false });
    expect(m1.location).toBeUndefined();
    expect(m1.responseDeadline).toBeUndefined();
    expect(board.get(m1.id)?.startsAt.toISOString()).toBe("2026-11-10T19:00:00.000Z");
  });

  it("장소·메모·응답 마감 일시(선택)를 함께 저장한다", () => {
    const { board } = setup();
    const m = board.create({
      title: "정기 모임",
      startsAt: at("2026-11-10T19:00:00Z"),
      location: "가짜체육관",
      memo: "실내화 지참",
      responseDeadline: at("2026-11-09T12:00:00Z"),
    });
    expect(m).toMatchObject({ location: "가짜체육관", memo: "실내화 지참" });
    expect(m.responseDeadline?.toISOString()).toBe("2026-11-09T12:00:00.000Z");
  });

  it("제목이 비었거나 날짜가 올바르지 않으면 오류", () => {
    const { board } = setup();
    expect(() => board.create({ title: "  ", startsAt: at("2026-11-10T19:00:00Z") })).toThrow(/제목/);
    expect(() => board.create({ title: "모임", startsAt: at("잘못된 날짜") })).toThrow(/날짜/);
  });

  it("(M2-Q8) 마감이 시작보다 늦으면 오류, 같으면 허용", () => {
    const { board } = setup();
    const startsAt = at("2026-11-10T19:00:00Z");
    expect(() => board.create({ title: "모임", startsAt, responseDeadline: at("2026-11-10T19:00:01Z") })).toThrow(
      /마감/,
    );
    expect(() => board.create({ title: "모임", startsAt, responseDeadline: startsAt })).not.toThrow();
  });

  it("반환된 Date를 바꿔도 저장된 모임은 바뀌지 않는다", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt: at("2026-11-10T19:00:00Z") });
    m.startsAt.setFullYear(2000);
    expect(board.get(m.id)?.startsAt.getUTCFullYear()).toBe(2026);
  });
});

describe("R-06 모임 수정·취소", () => {
  it("일부 항목만 수정하고, null 로 선택 항목을 지울 수 있다", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt: at("2026-11-10T19:00:00Z"), location: "가짜체육관" });
    const u = board.update(m.id, { title: "변경된 모임", memo: "메모" });
    expect(u).toMatchObject({ title: "변경된 모임", location: "가짜체육관", memo: "메모" });
    const cleared = board.update(m.id, { location: null });
    expect(cleared.location).toBeUndefined();
    expect(board.get(m.id)?.title).toBe("변경된 모임");
  });

  it("(M2-Q8) 수정 후 마감이 시작보다 늦어지면 오류", () => {
    const { board } = setup();
    const m = board.create({
      title: "모임",
      startsAt: at("2026-11-10T19:00:00Z"),
      responseDeadline: at("2026-11-09T19:00:00Z"),
    });
    expect(() => board.update(m.id, { startsAt: at("2026-11-08T19:00:00Z") })).toThrow(/마감/);
    expect(() => board.update(m.id, { responseDeadline: at("2026-11-11T19:00:00Z") })).toThrow(/마감/);
    expect(board.update(m.id, { responseDeadline: null }).responseDeadline).toBeUndefined();
  });

  it("취소된 모임은 목록에서 cancelled 로 구분되고, 수정·재취소는 오류 (M2-Q8)", () => {
    const { board } = setup();
    const m = board.create({ title: "모임", startsAt: at("2026-11-10T19:00:00Z") });
    board.create({ title: "다른 모임", startsAt: at("2026-11-12T19:00:00Z") });
    expect(board.cancel(m.id).cancelled).toBe(true);
    expect(board.list().map((x) => [x.title, x.cancelled])).toEqual([
      ["모임", true],
      ["다른 모임", false],
    ]);
    expect(() => board.update(m.id, { title: "x" })).toThrow(/취소/);
    expect(() => board.cancel(m.id)).toThrow(/취소/);
  });

  it("없는 모임 수정·취소·조회", () => {
    const { board } = setup();
    expect(board.get("없음")).toBeUndefined();
    expect(() => board.update("없음", { title: "x" })).toThrow(/찾을 수 없/);
    expect(() => board.cancel("없음")).toThrow(/찾을 수 없/);
  });
});

describe("R-06 다가오는 모임 목록", () => {
  it("현재 시각 이후 시작, 취소 제외, 시작 시각 순", () => {
    const { board } = setup();
    board.create({ title: "지난 모임", startsAt: at("2026-11-01T19:00:00Z") });
    board.create({ title: "나중 모임", startsAt: at("2026-11-20T19:00:00Z") });
    const cancelled = board.create({ title: "취소 모임", startsAt: at("2026-11-08T19:00:00Z") });
    board.create({ title: "곧 모임", startsAt: at("2026-11-06T19:00:00Z") });
    board.create({ title: "지금 시작", startsAt: at("2026-11-04T12:00:00Z") });
    board.cancel(cancelled.id);
    const now = at("2026-11-04T12:00:00Z");
    expect(board.upcoming(now).map((m) => m.title)).toEqual(["곧 모임", "나중 모임"]);
  });
});

describe("R-06 참석 응답", () => {
  const startsAt = at("2026-11-10T19:00:00Z");
  const deadline = at("2026-11-09T12:00:00Z");
  const before = at("2026-11-05T09:00:00Z");

  it("참석/불참/미정 응답과 변경, 집계 (인원 수와 회원 목록)", () => {
    const { board, a, b, c } = setup();
    const m = board.create({ title: "모임", startsAt });
    board.respond(m.id, a.id, "attending", before);
    board.respond(m.id, b.id, "undecided", before);
    board.respond(m.id, c.id, "absent", before);
    board.respond(m.id, b.id, "attending", before);
    expect(board.summary(m.id)).toEqual({
      attending: { count: 2, memberIds: [a.id, b.id] },
      absent: { count: 1, memberIds: [c.id] },
      undecided: { count: 0, memberIds: [] },
    });
  });

  it("응답이 없으면 모두 0, 모임별로 따로 집계", () => {
    const { board, a } = setup();
    const m1 = board.create({ title: "모임1", startsAt });
    const m2 = board.create({ title: "모임2", startsAt });
    board.respond(m1.id, a.id, "attending", before);
    expect(board.summary(m2.id).attending.count).toBe(0);
    expect(() => board.summary("없음")).toThrow(/찾을 수 없/);
  });

  it("(M2-Q6) 마감 시각과 같은 시각은 허용, 마감 이후 응답·변경은 오류", () => {
    const { board, a, b } = setup();
    const m = board.create({ title: "모임", startsAt, responseDeadline: deadline });
    board.respond(m.id, a.id, "attending", before);
    board.respond(m.id, b.id, "absent", deadline);
    const after = new Date(deadline.getTime() + 1);
    expect(() => board.respond(m.id, a.id, "absent", after)).toThrow(/마감/);
    expect(() => board.respond(m.id, b.id, "attending", after)).toThrow(/마감/);
    expect(board.summary(m.id).attending.memberIds).toEqual([a.id]);
  });

  it("(M2-Q7) 마감이 없으면 시작 시각 전까지만 응답 가능", () => {
    const { board, a } = setup();
    const m = board.create({ title: "모임", startsAt });
    board.respond(m.id, a.id, "attending", new Date(startsAt.getTime() - 1));
    expect(() => board.respond(m.id, a.id, "absent", startsAt)).toThrow(/시작/);
  });

  it("취소된 모임에 응답하면 오류", () => {
    const { board, a } = setup();
    const m = board.create({ title: "모임", startsAt });
    board.cancel(m.id);
    expect(() => board.respond(m.id, a.id, "attending", before)).toThrow(/취소/);
  });

  it("비활성·없는 회원은 응답 불가, 없는 모임·알 수 없는 응답은 오류", () => {
    const { members, board, a } = setup();
    const m = board.create({ title: "모임", startsAt });
    members.deactivate(a.id);
    expect(() => board.respond(m.id, a.id, "attending", before)).toThrow(/비활성/);
    expect(() => board.respond(m.id, "없는회원", "attending", before)).toThrow(/회원/);
    expect(() => board.respond("없음", a.id, "attending", before)).toThrow(/모임/);
    const bad = "maybe" as unknown as "attending";
    expect(() => board.respond(m.id, a.id, bad, before)).toThrow(/응답/);
  });
});
