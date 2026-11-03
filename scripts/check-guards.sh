#!/usr/bin/env bash
# 스택과 무관한 안전 검사. AGENTS.md "금지 사항" 중 기계적으로 잡을 수 있는 것을 강제합니다.
set -euo pipefail

fail=0

# 1) .env 파일이 git에 올라가 있으면 실패 (.env.example 은 허용)
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked_env=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)
  if [ -n "$tracked_env" ]; then
    echo "❌ .env 파일이 커밋되어 있습니다: $tracked_env"
    fail=1
  fi
fi

# 2) 흔한 비밀값 패턴 탐지 (src, tests 대상)
if [ -d src ] || [ -d tests ]; then
  hits=$(grep -rInE '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' src tests 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "❌ 비밀값으로 보이는 문자열이 있습니다:"
    echo "$hits"
    fail=1
  fi
fi

# 3) 테스트 건너뛰기(skip/only) 표시 탐지 — 테스트를 꺼서 통과시키는 것을 막음
if [ -d tests ]; then
  skips=$(grep -rInE '(\.skip\(|\.only\(|@pytest\.mark\.skip|xit\(|xdescribe\()' tests 2>/dev/null || true)
  if [ -n "$skips" ]; then
    echo "❌ 테스트 skip/only 표시가 있습니다 (docs/lessons.md에 사유를 남기고 사람이 승인해야 함):"
    echo "$skips"
    fail=1
  fi
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "✅ guards 통과"
