# 진행 상황

다른 도구나 다음 세션이 이어받을 수 있도록, 긴 작업이 끝날 때마다 짧게 갱신합니다.

- 2026-11-03: 신뢰 레이어 기본 구조 생성 (AGENTS.md, CLAUDE.md, 권한 설정, npm run check, CI, verify 스킬). 스택: TypeScript (Node 22, Vitest, ESLint, tsc). M1 요구사항·TASK-001 작성.
- 2026-11-03: 집 PC가 Windows라 완료 기준을 `make check` → `npm run check`로 변경, 안전 검사를 Node 스크립트로 이식.
- 2026-11-03: TASK-001 (M1 도메인) 구현 — 브랜치 `agent/m1-domain`. `src/rng.ts`(mulberry32 시드 RNG), `src/grade.ts`(주입형 등급 체계), `src/members.ts`(메모리 회원 저장소), `src/teams.ts`(multi-start 무작위 배정 + 교환 지역탐색). 테스트 43개 통과. 미확정 사항은 `docs/requirements.md` "M1 구현 중 나온 질문" Q1~Q7.
- 2026-11-03: TASK-001 회고 → PR 크기 검사 승격(PR #4). Q1~Q7 확정(Q6: 균형 기준 대기 선정) → TASK-002 작성.
