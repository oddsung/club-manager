// R-04: 출석 체크 (메모리 내 저장소).
// 회원은 M1의 MemberRegistry 로 조회만 하고, 모임은 문자열 ID(meetingId)로만 참조한다.
import type { Member, MemberRegistry } from "./members";

export interface AttendanceBook {
  /** 출석 체크. 없는 회원·비활성 회원·이미 체크된 회원이면 오류. */
  check(meetingId: string, memberId: string): void;
  /** 체크 취소. 체크되지 않은 회원이면 오류. 비활성 회원도 취소 가능 (M2-Q2). */
  uncheck(meetingId: string, memberId: string): void;
  /** 체크했는지 여부. 모임 ID가 비어 있거나 공백뿐이면 오류 (M2-Q13). */
  isChecked(meetingId: string, memberId: string): boolean;
  /**
   * 모임별 출석자 목록 (체크한 순서). R-03 formTeams 의 attendees 로 그대로 쓸 수 있다.
   * 체크 후 비활성화된 회원은 제외한다 (M2-Q2). 회원 정보는 조회 시점의 최신 값.
   */
  attendees(meetingId: string): Member[];
  /** 회원별 출석 이력 (모임 ID, 체크한 순서). 없는 회원이면 오류. */
  history(memberId: string): string[];
  /**
   * 출석률 = 주어진 모임 중 출석한 모임 수 / 모임 수 (0~1).
   * 목록이 비어 있으면 0 (M2-Q1). 목록에 같은 모임 ID가 중복되면 오류.
   */
  attendanceRate(memberId: string, meetingIds: readonly string[]): number;
}

export function createAttendanceBook(registry: MemberRegistry): AttendanceBook {
  /** meetingId → 체크한 회원 ID (삽입 순서 유지). */
  const byMeeting = new Map<string, Set<string>>();
  /** memberId → 출석한 모임 ID (삽입 순서 유지). */
  const byMember = new Map<string, Set<string>>();

  function validMeetingId(meetingId: string): string {
    if (meetingId.trim() === "") throw new Error("모임 ID는 필수입니다.");
    return meetingId;
  }

  function mustGetMember(memberId: string): Member {
    const m = registry.get(memberId);
    if (!m) throw new Error(`회원을 찾을 수 없습니다: ${memberId}`);
    return m;
  }

  function setOf<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
    let s = map.get(key);
    if (!s) {
      s = new Set<V>();
      map.set(key, s);
    }
    return s;
  }

  function isChecked(meetingId: string, memberId: string): boolean {
    return byMeeting.get(meetingId)?.has(memberId) ?? false;
  }

  return {
    check(meetingId, memberId) {
      validMeetingId(meetingId);
      const member = mustGetMember(memberId);
      if (!member.active) throw new Error(`비활성 회원은 출석 체크할 수 없습니다: ${memberId}`);
      if (isChecked(meetingId, memberId)) {
        throw new Error(`이미 출석 체크된 회원입니다: ${memberId} (모임 ${meetingId})`);
      }
      setOf(byMeeting, meetingId).add(memberId);
      setOf(byMember, memberId).add(meetingId);
    },
    uncheck(meetingId, memberId) {
      validMeetingId(meetingId);
      mustGetMember(memberId);
      if (!isChecked(meetingId, memberId)) {
        throw new Error(`출석 체크되지 않은 회원입니다: ${memberId} (모임 ${meetingId})`);
      }
      byMeeting.get(meetingId)?.delete(memberId);
      byMember.get(memberId)?.delete(meetingId);
    },
    isChecked(meetingId, memberId) {
      // M2-Q13: 다른 함수와 같이 공백뿐인 모임 ID는 오류
      return isChecked(validMeetingId(meetingId), memberId);
    },
    attendees(meetingId) {
      validMeetingId(meetingId);
      const ids = byMeeting.get(meetingId) ?? new Set<string>();
      return [...ids].map(mustGetMember).filter((m) => m.active);
    },
    history(memberId) {
      mustGetMember(memberId);
      return [...(byMember.get(memberId) ?? [])];
    },
    attendanceRate(memberId, meetingIds) {
      mustGetMember(memberId);
      meetingIds.forEach(validMeetingId);
      if (new Set(meetingIds).size !== meetingIds.length) {
        throw new Error("출석률 계산 대상 모임 ID가 중복되었습니다.");
      }
      if (meetingIds.length === 0) return 0;
      const attended = meetingIds.filter((id) => isChecked(id, memberId)).length;
      return attended / meetingIds.length;
    },
  };
}
