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
