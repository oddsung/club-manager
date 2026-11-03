# 완료 기준: make check
# 스택(언어/프레임워크)이 정해지면 lint/test 타깃 안의 TODO 줄만 실제 명령으로 바꿉니다.

.PHONY: check lint test guards

check: guards lint test
	@echo "✅ make check 통과"

# 스택과 무관하게 항상 강제하는 안전 검사
guards:
	@bash scripts/check-guards.sh

lint:
	@echo "ℹ️  lint: 스택 미정 — 스택 결정 후 실제 린터로 교체"
	@# TODO: 예) npx eslint . / ruff check .

test:
	@echo "ℹ️  test: 스택 미정 — 스택 결정 후 실제 테스트로 교체"
	@# TODO: 예) npx vitest run / pytest
