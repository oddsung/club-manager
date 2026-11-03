// R-06: 모임 일정 공지 (메모리 내 저장소).
// 현재 시각은 항상 인자(now)로 주입받는다 (M2 공통 규칙).
import type { MemberRegistry } from "./members";

export type ResponseStatus = "attending" | "absent" | "undecided";

export interface Meeting {
  readonly id: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly location?: string;
  readonly memo?: string;
  /** 응답 마감 일시. 없으면 시작 시각 전까지 응답 가능 (M2-Q7). */
  readonly responseDeadline?: Date;
  readonly cancelled: boolean;
}

export interface NewMeeting {
  title: string;
  startsAt: Date;
  location?: string;
  memo?: string;
  responseDeadline?: Date;
}

/** undefined 는 기존 값 유지, null 은 선택 항목 삭제. */
export interface MeetingUpdate {
  title?: string;
  startsAt?: Date;
  location?: string | null;
  memo?: string | null;
  responseDeadline?: Date | null;
}

export interface ResponseSummary {
  readonly attending: { readonly count: number; readonly memberIds: readonly string[] };
  readonly absent: { readonly count: number; readonly memberIds: readonly string[] };
  readonly undecided: { readonly count: number; readonly memberIds: readonly string[] };
}

export interface MeetingBoardOptions {
  /** 회원 활성 여부 확인용 (M1 회원 저장소 참조만 한다). */
  members: Pick<MemberRegistry, "get">;
  /** 기본값은 "mt-1", "mt-2", ... */
  idGenerator?: () => string;
}

export interface MeetingBoard {
  create(input: NewMeeting): Meeting;
  /** 없으면 undefined. */
  get(id: string): Meeting | undefined;
  /** 생성 순서대로. 취소된 모임도 포함 (cancelled 로 구분). */
  list(): Meeting[];
  /** 취소된 모임은 수정 불가 (M2-Q8). */
  update(id: string, changes: MeetingUpdate): Meeting;
  /** 이미 취소된 모임을 다시 취소하면 오류. */
  cancel(id: string): Meeting;
  /** now 이후 시작, 취소 제외, 시작 시각 순. */
  upcoming(now: Date): Meeting[];
  respond(meetingId: string, memberId: string, status: ResponseStatus, now: Date): void;
  /** 회원 목록은 처음 응답한 순서대로. 비활성 회원은 제외 (M2-Q16). */
  summary(meetingId: string): ResponseSummary;
}

const STATUSES: readonly ResponseStatus[] = ["attending", "absent", "undecided"];

function validDate(d: Date, label: string): Date {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw new Error(`${label}이(가) 올바른 날짜가 아닙니다.`);
  return new Date(d.getTime());
}

function validTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed === "") throw new Error("모임 제목은 필수입니다.");
  return trimmed;
}

function checkDeadline(startsAt: Date, deadline: Date | undefined): void {
  if (deadline && deadline.getTime() > startsAt.getTime()) {
    throw new Error("응답 마감 일시는 시작 일시보다 늦을 수 없습니다.");
  }
}

function build(fields: Omit<Meeting, "location" | "memo" | "responseDeadline"> & {
  location?: string | undefined;
  memo?: string | undefined;
  responseDeadline?: Date | undefined;
}): Meeting {
  const m: { -readonly [K in keyof Meeting]: Meeting[K] } = {
    id: fields.id,
    title: fields.title,
    startsAt: fields.startsAt,
    cancelled: fields.cancelled,
  };
  if (fields.location !== undefined) m.location = fields.location;
  if (fields.memo !== undefined) m.memo = fields.memo;
  if (fields.responseDeadline !== undefined) m.responseDeadline = fields.responseDeadline;
  return Object.freeze(m);
}

/** 반환 시 내부 Date 를 외부에서 바꾸지 못하게 복사본을 준다. */
function copy(m: Meeting): Meeting {
  return build({
    ...m,
    startsAt: new Date(m.startsAt.getTime()),
    responseDeadline: m.responseDeadline && new Date(m.responseDeadline.getTime()),
  });
}

export function createMeetingBoard(options: MeetingBoardOptions): MeetingBoard {
  const { members } = options;
  let counter = 0;
  const nextId = options.idGenerator ?? (() => `mt-${++counter}`);
  const store = new Map<string, Meeting>();
  const responses = new Map<string, Map<string, ResponseStatus>>();

  function mustGet(id: string): Meeting {
    const m = store.get(id);
    if (!m) throw new Error(`모임을 찾을 수 없습니다: ${id}`);
    return m;
  }

  function save(m: Meeting): Meeting {
    store.set(m.id, m);
    return copy(m);
  }

  return {
    create(input) {
      const title = validTitle(input.title);
      const startsAt = validDate(input.startsAt, "시작 일시");
      const responseDeadline =
        input.responseDeadline === undefined ? undefined : validDate(input.responseDeadline, "응답 마감 일시");
      checkDeadline(startsAt, responseDeadline);
      const id = nextId();
      if (store.has(id)) throw new Error(`이미 존재하는 모임 ID입니다: ${id}`);
      responses.set(id, new Map());
      return save(
        build({ id, title, startsAt, location: input.location, memo: input.memo, responseDeadline, cancelled: false }),
      );
    },
    get(id) {
      const m = store.get(id);
      return m && copy(m);
    },
    list() {
      return [...store.values()].map(copy);
    },
    update(id, changes) {
      const current = mustGet(id);
      if (current.cancelled) throw new Error(`취소된 모임은 수정할 수 없습니다: ${id}`);
      const startsAt = changes.startsAt === undefined ? current.startsAt : validDate(changes.startsAt, "시작 일시");
      const responseDeadline =
        changes.responseDeadline === undefined
          ? current.responseDeadline
          : changes.responseDeadline === null
            ? undefined
            : validDate(changes.responseDeadline, "응답 마감 일시");
      checkDeadline(startsAt, responseDeadline);
      return save(
        build({
          id,
          title: changes.title === undefined ? current.title : validTitle(changes.title),
          startsAt,
          location: changes.location === undefined ? current.location : (changes.location ?? undefined),
          memo: changes.memo === undefined ? current.memo : (changes.memo ?? undefined),
          responseDeadline,
          cancelled: false,
        }),
      );
    },
    cancel(id) {
      const current = mustGet(id);
      if (current.cancelled) throw new Error(`이미 취소된 모임입니다: ${id}`);
      return save(build({ ...current, cancelled: true }));
    },
    upcoming(now) {
      const t = validDate(now, "현재 시각").getTime();
      return [...store.values()]
        .filter((m) => !m.cancelled && m.startsAt.getTime() > t)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .map(copy);
    },
    respond(meetingId, memberId, status, now) {
      const meeting = mustGet(meetingId);
      if (!STATUSES.includes(status)) throw new Error(`알 수 없는 응답입니다: ${String(status)}`);
      const t = validDate(now, "현재 시각").getTime();
      if (meeting.cancelled) throw new Error(`취소된 모임에는 응답할 수 없습니다: ${meetingId}`);
      if (meeting.responseDeadline) {
        // M2-Q6: 마감 시각과 같은 시각은 허용
        if (t > meeting.responseDeadline.getTime()) throw new Error(`응답 마감이 지났습니다: ${meetingId}`);
      } else if (t >= meeting.startsAt.getTime()) {
        // M2-Q7: 마감이 없으면 시작 시각 전까지만
        throw new Error(`모임이 이미 시작되어 응답할 수 없습니다: ${meetingId}`);
      }
      const member = members.get(memberId);
      if (!member) throw new Error(`회원을 찾을 수 없습니다: ${memberId}`);
      if (!member.active) throw new Error(`비활성 회원은 응답할 수 없습니다: ${memberId}`);
      responses.get(meetingId)?.set(memberId, status);
    },
    summary(meetingId) {
      mustGet(meetingId);
      // M2-Q16: 비활성 회원 응답은 집계에서 제외 (응답 자체는 보관하므로 재활성화되면 다시 보인다)
      const entries = [...(responses.get(meetingId) ?? new Map<string, ResponseStatus>()).entries()].filter(
        ([memberId]) => members.get(memberId)?.active === true,
      );
      const pick = (s: ResponseStatus) => {
        const memberIds = entries.filter(([, v]) => v === s).map(([k]) => k);
        return Object.freeze({ count: memberIds.length, memberIds: Object.freeze(memberIds) });
      };
      return Object.freeze({ attending: pick("attending"), absent: pick("absent"), undecided: pick("undecided") });
    },
  };
}
