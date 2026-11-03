// R-01: 회원 관리 (메모리 내 저장소).
import type { GradeScale } from "./grade";

export interface Member {
  readonly id: string;
  readonly name: string;
  /** 등급 점수 (R-02). 주입된 등급 체계에 존재하는 값만 허용. */
  readonly grade: number;
  /** false 이면 탈퇴(비활성) 회원 — 팀 편성에서 제외된다. */
  readonly active: boolean;
}

export interface NewMember {
  name: string;
  grade: number;
}

export interface MemberUpdate {
  name?: string;
  grade?: number;
}

export interface MemberRegistryOptions {
  scale: GradeScale;
  /** 테스트 등에서 ID 생성 방식을 바꿀 때 사용. 기본값은 "m-1", "m-2", ... */
  idGenerator?: () => string;
}

export interface MemberRegistry {
  readonly scale: GradeScale;
  register(input: NewMember): Member;
  /** 없으면 undefined. */
  get(id: string): Member | undefined;
  /** 기본은 활성 회원만. 등록 순서대로. */
  list(options?: { includeInactive?: boolean }): Member[];
  update(id: string, changes: MemberUpdate): Member;
  changeGrade(id: string, grade: number): Member;
  /** 탈퇴 처리 (비활성화). 기록은 남는다. */
  deactivate(id: string): Member;
}

export function createMemberRegistry(options: MemberRegistryOptions): MemberRegistry {
  const { scale } = options;
  let counter = 0;
  const nextId = options.idGenerator ?? (() => `m-${++counter}`);
  const store = new Map<string, Member>();

  function validName(name: string): string {
    const trimmed = name.trim();
    if (trimmed === "") throw new Error("회원 이름은 필수입니다.");
    return trimmed;
  }

  function validGrade(grade: number): number {
    if (!scale.isValid(grade)) {
      const allowed = scale.levels.map((l) => l.score).join(", ");
      throw new Error(`등급 체계에 없는 점수입니다: ${grade} (허용: ${allowed})`);
    }
    return grade;
  }

  function mustGet(id: string): Member {
    const m = store.get(id);
    if (!m) throw new Error(`회원을 찾을 수 없습니다: ${id}`);
    return m;
  }

  function save(m: Member): Member {
    const frozen = Object.freeze({ ...m });
    store.set(frozen.id, frozen);
    return frozen;
  }

  return {
    scale,
    register(input) {
      const name = validName(input.name);
      const grade = validGrade(input.grade);
      const id = nextId();
      if (store.has(id)) throw new Error(`이미 존재하는 회원 ID입니다: ${id}`);
      return save({ id, name, grade, active: true });
    },
    get: (id) => store.get(id),
    list(opts) {
      const all = [...store.values()];
      return opts?.includeInactive ? all : all.filter((m) => m.active);
    },
    update(id, changes) {
      const current = mustGet(id);
      return save({
        ...current,
        name: changes.name === undefined ? current.name : validName(changes.name),
        grade: changes.grade === undefined ? current.grade : validGrade(changes.grade),
      });
    },
    changeGrade(id, grade) {
      return this.update(id, { grade });
    },
    deactivate(id) {
      return save({ ...mustGet(id), active: false });
    },
  };
}
