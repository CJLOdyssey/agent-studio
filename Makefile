.PHONY: test test-backend test-frontend lint-backend lint-frontend coverage

IGNORE=--ignore=tests/e2e/ --ignore=tests/repository/ --ignore=tests/routers/auth/test_auth_api.py

test: test-backend test-frontend

test-backend:
	pytest --cov=backend $(IGNORE)

test-backend-quick:
	pytest -q -x --tb=short $(IGNORE)

test-frontend:
	cd frontend && npx vitest run --coverage.enabled

lint-backend:
	ruff check backend/

lint-frontend:
	cd frontend && npx eslint src/

format-backend:
	ruff format backend/

coverage:
	pytest --cov=backend --cov-report=term-missing $(IGNORE)

.PHONY: dev-backend dev-backend-logs health

## Start backend (自动杀旧进程 + 端口检测, 默认不带 --reload)
dev-backend:
	@bash scripts/dev/run-backend.sh

## Start backend with hot-reload (有风险: 可能触发子进程卡死)
dev-backend-reload:
	RELOAD=1 bash scripts/dev/run-backend.sh

## Tail backend logs
dev-backend-logs:
	tail -f /tmp/backend.log

## Run health check against backend
health:
	python scripts/dev/health.py --port ${PORT:-8080} --check-orphans
