# AGENTS.md — 모든 AI 코딩 에이전트 공통 규칙

이 파일은 Claude Code, Cursor, Zed, Antigravity, VS Code 등 어떤 도구로 작업하든 동일하게 따르는 규칙입니다.
도구별 전용 설정은 각 도구 파일(CLAUDE.md 등)에만 두고, 공통 규칙은 반드시 이 파일에 둡니다.

## 프로젝트 개요
- 이름: club-manager (운동 동호회 관리 프로그램)
- 단계: 파일럿 — 에이전트 관리 환경(신뢰 레이어) 검증용
- 스택: TypeScript (Node 22), 테스트 Vitest, 린트 ESLint(typescript-eslint), 타입검사 tsc
- 의존성 설치: `npm ci` (새 패키지 추가는 사람 승인 필요)
- 개발 PC는 Windows(PowerShell)입니다. 명령은 OS 공통인 npm 스크립트를 사용하고, bash 전용 문법·`make` 에 의존하지 않습니다.
- 상세 요구사항은 `docs/requirements.md`에 누적 기록합니다. 기록되지 않은 요구사항을 추측해서 구현하지 마세요.

## 완료의 정의 (가장 중요)
- 작업 완료 = `npm run check` 가 로컬에서 통과하는 상태입니다.
- `npm run check` 를 실행하지 않았거나 실패한 상태에서 "완료"라고 보고하지 마세요.
- 새 기능에는 반드시 테스트를 함께 추가합니다. 테스트 없는 기능 추가는 미완료로 봅니다.

## 작업 방식
- `main` 브랜치에 직접 커밋하지 않습니다. 작업마다 `agent/<짧은-설명>` 브랜치를 만들고 PR로 올립니다.
- 하나의 PR은 하나의 목적만 다룹니다. 관련 없는 리팩터링을 섞지 마세요.
- PR은 폰에서 리뷰할 수 있는 크기로 유지합니다. 코드·테스트 변경이 500줄을 넘으면 CI가 실패합니다(`scripts/check-pr-size.mjs`).
  작업이 크면 시작 전에 여러 PR로 나누는 계획을 먼저 보고하세요.
- 요구사항이 모호하면 구현 전에 질문합니다. 추측으로 범위를 넓히지 않습니다.
- 버그 수정은 먼저 실패하는 테스트로 재현한 뒤 고칩니다.

## 팀 작업 (코디네이터 + 팀원)
- **코디네이터(리드)는 코드를 쓰지 않습니다.** `src/`, `tests/` 를 직접 수정하지 않고, 계획·분배·통합 점검·보고만 합니다.
  코디네이터가 수정해도 되는 파일은 `docs/` 뿐입니다.
- **팀원은 각자 자기 worktree에서만 작업합니다.** 시작할 때 아래처럼 만듭니다.
  ```
  git fetch origin main
  git worktree add .worktrees/<이름> -b agent/<이름> origin/main
  npm --prefix .worktrees/<이름> ci
  ```
- **명령은 한 번에 하나씩, 폴더 이동(`cd`) 없이** 아래 형식으로만 실행합니다. `cd ... && git ...` 처럼 이어 붙이면
  허용 목록에 맞지 않아 승인 요청이 생기는데, **팀원의 승인 요청은 사람의 휴대폰에 전달되지 않아 작업이 조용히 멈춥니다** (TASK-003에서 확인).

  | 하려는 일 | 이렇게 실행 |
  |---|---|
  | 검사 | `npm --prefix .worktrees/<이름> run check` |
  | 상태·변경 확인 | `git -C .worktrees/<이름> status` / `git -C .worktrees/<이름> diff --stat` |
  | 커밋 | `git -C .worktrees/<이름> add <파일>` 실행 후 따로 `git -C .worktrees/<이름> commit -m "..."` |
  | push | `git -C .worktrees/<이름> push -u origin agent/<이름>` |
  | PR 생성 | `gh pr create --base main --head agent/<이름> --title "..." --body "..."` |

- 파일 수정은 `.worktrees/<이름>/src/...`, `.worktrees/<이름>/tests/...` 경로로 합니다.
- 위 표에 없는 명령이 꼭 필요하면 실행하지 말고 먼저 코디네이터에게 메시지로 알립니다. 코디네이터는 사람에게 보고합니다.
- 팀원은 배정된 파일만 만들고 고칩니다. 다른 팀원 파일, `src/index.ts`, `docs/` 는 수정하지 않습니다.
  모호한 점은 직접 문서에 쓰지 말고 코디네이터에게 메시지로 보냅니다. 코디네이터가 `docs/requirements.md` "논의 중"에 모아 기록합니다.
- 팀원은 자기 worktree에서 `npm run check` 통과 → push → PR 생성까지 하고 코디네이터에게 PR 번호를 보고합니다.
- 코디네이터는 팀원이 실제로 무엇을 실행했는지, 승인 대기 중인지 직접 볼 수 없습니다. 보고에는 **확인한 사실과 추정을 구분**해 적습니다.

## 금지 사항
- `.env`, 비밀번호, API 키, 토큰을 코드·커밋·로그에 넣지 않습니다. 필요한 값은 `.env.example`에 키 이름만 적습니다.
- 회원 개인정보(이름, 연락처 등) 실데이터를 테스트 픽스처에 넣지 않습니다. 가짜 데이터만 사용합니다.
- 기존 테스트를 삭제하거나 건너뛰게(skip) 만들어서 `npm run check`를 통과시키지 않습니다.
- `git push --force`, 브랜치 삭제, 히스토리 재작성은 하지 않습니다.

## 실수 기록 → 규칙 승격
- 에이전트가 같은 종류의 실수를 반복하면 `docs/lessons.md`에 기록합니다.
- 기록된 실수 중 기계적으로 잡을 수 있는 것은 이 파일의 규칙이 아니라 `npm run check`(lint/test/CI) 검사로 옮깁니다.
  규칙 파일은 "부탁"이고, 검사는 "강제"입니다.

## 명령어
| 목적 | 명령 |
|---|---|
| 전체 검증 (완료 기준) | `npm run check` |
| 테스트만 | `npm run test` |
| 린트만 | `npm run lint` |
| 타입 검사만 | `npm run typecheck` |
| 안전 검사만 | `npm run guards` |
