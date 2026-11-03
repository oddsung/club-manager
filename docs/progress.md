# 진행 상황

다른 도구나 다음 세션이 이어받을 수 있도록, 긴 작업이 끝날 때마다 짧게 갱신합니다.

- 2026-11-03: 신뢰 레이어 기본 구조 생성 (AGENTS.md, CLAUDE.md, 권한 설정, npm run check, CI, verify 스킬). 스택: TypeScript (Node 22, Vitest, ESLint, tsc). M1 요구사항·TASK-001 작성.
- 2026-11-03: 집 PC가 Windows라 완료 기준을 `make check` → `npm run check`로 변경, 안전 검사를 Node 스크립트로 이식.
- 2026-11-03: TASK-001 (M1 도메인) 구현 — 브랜치 `agent/m1-domain`. `src/rng.ts`(mulberry32 시드 RNG), `src/grade.ts`(주입형 등급 체계), `src/members.ts`(메모리 회원 저장소), `src/teams.ts`(multi-start 무작위 배정 + 교환 지역탐색). 테스트 43개 통과. 미확정 사항은 `docs/requirements.md` "M1 구현 중 나온 질문" Q1~Q7.
- 2026-11-03: TASK-001 회고 → PR 크기 검사 승격(PR #4). Q1~Q7 확정(Q6: 균형 기준 대기 선정) → TASK-002 작성.
- 2026-11-04: TASK-002 (Q1~Q7 반영) — PR 3개, 모두 main 기준 독립 브랜치. `agent/r01-reactivate`(Q1 재활성화, Q2·Q3 테스트), `agent/r03-team-count`(Q5 팀 수 ≥ 2, Q4 표시), `agent/r03-balanced-waiting`(Q6 균형 기준 대기 선정: 기존 방식 결과를 시작점으로 두고 출전자↔대기자 교환 지역탐색 추가, 기존보다 엄격히 좋을 때만 교체). Q7은 기존 테스트("A~D 체계를 주입하면 라벨→점수로 등록")로 충족.
- 2026-11-04: 사이클 2(TASK-002, PR #6~#8) 완료. 1단계 통과 판정. docs/environment-roadmap.md 추가.
- 2026-11-04: 2단계 트랙 A 준비 — 에이전트 팀 활성화, worktree 권한·검사 제외, 시각 주입 lint, M2 요구사항 초안, TASK-003.
- 2026-11-04: TASK-003 (M2 병렬) — 리드 + 팀원 3명(에이전트 팀, 각자 worktree). PR #11 `dues`(R-05, +242), #12 `meetings`(R-06, +398), #13 `attendance`(R-04, +260). 3개 CI 통과, 임시 통합 worktree(`.worktrees/integration`, detached)에서 3개 병합 → 충돌 없음, `npm run check` 통과(테스트 98개). 결정 M2-Q1~Q9와 팀원 자체 판단 6건은 `docs/requirements.md`. worktree 4개는 사람 확인 후 정리.
- 2026-11-04: TASK-003 회고 — 팀원 승인 요청이 휴대폰에 오지 않는 문제 확인, 사이클 3 기록 정정, 2단계 조건부 판정. 권한 설정 변경은 사람 승인 대기.
- 2026-11-04: (사람 승인) 팀원 push·PR을 agent/* 한정 허용, main push 금지, 팀원 명령 형식 통일. 팀원 자체 판단 6건 확정. TASK-004(휴대폰만으로 재검증) 작성.
- 2026-11-04: TASK-004 (휴대폰만으로 병렬 재검증) — 팀원 3명, PR #17 `dues.edge`(13개), #18 `attendance.edge`(17개), #19 `meetings.edge`(20개). 각 PR 테스트 파일 1개, CI 통과. 통합 worktree(`.worktrees/integration-004`)에서 병합 → 충돌 없음, `npm run check` 통과(테스트 148개). 사람 승인 1회(계획)만으로 완료 — 팀원 승인 요청·표 밖 명령 요청 메시지 0건(리드 관찰 기준). 3개 PR 머지. 버그 없음. 미정 동작 M2-Q10~Q16을 `docs/requirements.md`에 기록. 팀원 2명이 `/verify` 대신 `npm run check`만 실행 → 다음 spawn 프롬프트에 명시 필요.
