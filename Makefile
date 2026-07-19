.PHONY: test test-backend test-frontend lint-backend lint-frontend coverage

test: test-backend test-frontend

test-backend:
	pytest --cov=backend

test-backend-quick:
	pytest -q -x --tb=short

test-frontend:
	cd frontend && npx vitest run --coverage.enabled

lint-backend:
	ruff check backend/

lint-frontend:
	cd frontend && npx eslint src/

format-backend:
	ruff format backend/

coverage:
	pytest --cov=backend --cov-report=term-missing
