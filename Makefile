# 완료 기준: make check

.PHONY: check lint typecheck test guards install

check: guards lint typecheck test
	@echo "✅ make check 통과"

install:
	npm ci

# 스택과 무관하게 항상 강제하는 안전 검사
guards:
	@bash scripts/check-guards.sh

lint:
	@npx --no-install eslint .

typecheck:
	@npx --no-install tsc --noEmit

test:
	@npx --no-install vitest run
