import { describe, expect, it } from "vitest";
import { createGradeScale, rangeGradeScale } from "../src/grade";
import { createMemberRegistry } from "../src/members";

// 가짜 데이터만 사용 (AGENTS.md 금지 사항)
const newRegistry = () => createMemberRegistry({ scale: rangeGradeScale(1, 5) });

describe("R-01 회원 관리", () => {
  it("이름과 등급으로 등록하면 고유 ID가 부여되고 활성 상태다", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "테스트회원A", grade: 3 });
    const b = reg.register({ name: "테스트회원B", grade: 5 });
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ name: "테스트회원A", grade: 3, active: true });
  });

  it("이름은 필수 (공백만 있으면 오류), 앞뒤 공백은 제거", () => {
    const reg = newRegistry();
    expect(() => reg.register({ name: "", grade: 3 })).toThrow(/이름/);
    expect(() => reg.register({ name: "   ", grade: 3 })).toThrow(/이름/);
    expect(reg.register({ name: "  회원  ", grade: 3 }).name).toBe("회원");
  });

  it("등급은 필수이며 주입된 등급 체계에 있어야 한다", () => {
    const reg = newRegistry();
    expect(() => reg.register({ name: "회원", grade: 0 })).toThrow(/등급/);
    expect(() => reg.register({ name: "회원", grade: 2.5 })).toThrow(/등급/);
  });

  it("ID로 조회, 없는 ID는 undefined", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    expect(reg.get(a.id)).toEqual(a);
    expect(reg.get("없는-ID")).toBeUndefined();
  });

  it("목록 조회는 기본적으로 활성 회원만, 옵션으로 전체", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원1", grade: 1 });
    const b = reg.register({ name: "회원2", grade: 2 });
    reg.deactivate(a.id);
    expect(reg.list().map((m) => m.id)).toEqual([b.id]);
    expect(reg.list({ includeInactive: true }).map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it("정보 수정: 이름/등급 변경, 검증 규칙 동일 적용", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    const updated = reg.update(a.id, { name: "새이름" });
    expect(updated).toMatchObject({ id: a.id, name: "새이름", grade: 2 });
    expect(() => reg.update(a.id, { name: " " })).toThrow();
    expect(() => reg.update(a.id, { grade: 9 })).toThrow();
    expect(() => reg.update("없는-ID", { name: "x" })).toThrow(/찾을 수 없/);
  });

  it("탈퇴(비활성화): 기록은 남고 active=false", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    reg.deactivate(a.id);
    expect(reg.get(a.id)?.active).toBe(false);
    expect(() => reg.deactivate("없는-ID")).toThrow();
  });

  it("(Q1) 비활성 회원을 재활성화하면 다시 활성 목록에 나온다", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    reg.deactivate(a.id);
    const back = reg.reactivate(a.id);
    expect(back).toMatchObject({ id: a.id, name: "회원", grade: 2, active: true });
    expect(reg.get(a.id)?.active).toBe(true);
    expect(reg.list().map((m) => m.id)).toEqual([a.id]);
  });

  it("(Q1) 이미 활성인 회원을 재활성화하면 오류, 없는 ID도 오류", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    expect(() => reg.reactivate(a.id)).toThrow(/이미 활성/);
    expect(() => reg.reactivate("없는-ID")).toThrow(/찾을 수 없/);
  });

  it("(Q2) 비활성 회원도 정보·등급을 수정할 수 있고, 수정해도 비활성 상태는 유지된다", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    reg.deactivate(a.id);
    expect(reg.update(a.id, { name: "새이름" })).toMatchObject({ name: "새이름", active: false });
    expect(reg.changeGrade(a.id, 5)).toMatchObject({ grade: 5, active: false });
    expect(reg.get(a.id)).toMatchObject({ name: "새이름", grade: 5, active: false });
  });

  it("(Q3) 기본 ID는 저장소 내 순번 m-1, m-2, … 이다", () => {
    const reg = newRegistry();
    const ids = [1, 2, 3].map((g) => reg.register({ name: `회원${g}`, grade: g }).id);
    expect(ids).toEqual(["m-1", "m-2", "m-3"]);
    expect(newRegistry().register({ name: "회원", grade: 1 }).id).toBe("m-1"); // 저장소마다 따로 센다
  });

  it("반환된 회원 객체를 바꿔도 저장소는 영향받지 않는다", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    expect(Object.isFrozen(a)).toBe(true);
    expect(reg.get(a.id)?.name).toBe("회원");
  });

  it("주입한 ID 생성기가 중복 ID를 내면 오류", () => {
    const reg = createMemberRegistry({ scale: rangeGradeScale(1, 5), idGenerator: () => "same" });
    reg.register({ name: "회원1", grade: 1 });
    expect(() => reg.register({ name: "회원2", grade: 1 })).toThrow(/ID/);
  });
});

describe("R-02 회원 등급 변경", () => {
  it("changeGrade 로 등급을 바꿀 수 있다", () => {
    const reg = newRegistry();
    const a = reg.register({ name: "회원", grade: 2 });
    expect(reg.changeGrade(a.id, 4).grade).toBe(4);
    expect(reg.get(a.id)?.grade).toBe(4);
    expect(() => reg.changeGrade(a.id, 6)).toThrow();
  });

  it("A~D 체계를 주입하면 라벨→점수로 등록", () => {
    const scale = createGradeScale({ A: 4, B: 3, C: 2, D: 1 });
    const reg = createMemberRegistry({ scale });
    const m = reg.register({ name: "회원", grade: scale.scoreOf("B") });
    expect(m.grade).toBe(3);
    expect(scale.labelOf(m.grade)).toBe("B");
  });
});
