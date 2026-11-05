// R-11: 최근 모임 결석 회원 조회.
// 기존 저장소(R-01 회원, R-04 출석, R-06 모임)를 수정하지 않고 조합만 한다 (R11-8).
// 현재 시각은 항상 인자(now)로 주입받는다 (M2 공통 규칙).
import type { AttendanceBook } from "./attendance";
import type { MeetingBoard } from "./meetings";
import type { Member, MemberRegistry } from "./members";

export interface AbsenteeSources {
  members: Pick<MemberRegistry, "list">;
  meetings: Pick<MeetingBoard, "list">;
  attendance: Pick<AttendanceBook, "isChecked">;
}

export const DEFAULT_RECENT_COUNT = 3;

/**
 * 최근 count 회(기본 3) 지난 모임에 한 번도 출석 체크되지 않은 활성 회원 (등록 순서).
 * - 지난 모임 = 취소되지 않았고 startsAt <= now. 시작 시각이 같으면 나중에 생성된 모임이 더 최근 (R11-1)
 * - 지난 모임이 count 보다 적으면 있는 것만으로, 0회면 빈 목록 (R11-3)
 * - 출석 체크 기록만 본다. 참석 응답은 보지 않는다 (R11-6)
 */
export function recentAbsentees(sources: AbsenteeSources, now: Date, count: number = DEFAULT_RECENT_COUNT): Member[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`조회 회수는 1 이상의 정수여야 합니다: ${String(count)}`);
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("현재 시각이(가) 올바른 날짜가 아닙니다.");
  }
  const t = now.getTime();
  // list() 는 생성 순서이므로 인덱스를 동순위 기준으로 쓴다 (나중 생성 = 더 최근)
  const recent = sources.meetings
    .list()
    .map((m, order) => ({ m, order }))
    .filter(({ m }) => !m.cancelled && m.startsAt.getTime() <= t)
    .sort((a, b) => b.m.startsAt.getTime() - a.m.startsAt.getTime() || b.order - a.order)
    .slice(0, count)
    .map(({ m }) => m.id);
  if (recent.length === 0) return [];
  // R11-4: list() 기본값은 활성 회원만, 등록 순서 (R11-7)
  return sources.members
    .list()
    .filter((member) => recent.every((meetingId) => !sources.attendance.isChecked(meetingId, member.id)));
}
