.PHONY: dev build test lint typecheck format clean pip-install pip-install-dev test-backend lint-backend typecheck-backend docker-up docker-build docker-down docker-logs

dev:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

test:
	cd frontend && npm test

lint:
	cd frontend && npm run lint

typecheck:
	cd frontend && npm run typecheck

format:
	cd frontend && npm run format

# ── Backend ──────────────────────────────────────────────────────────

pip-install:
	pip install -r requirements.txt

pip-install-dev:
	pip install -r requirements.txt -r requirements-dev.txt

test-backend:
	python3 -m pytest tests/ -v --tb=short

lint-backend:
	ruff check virtual_team/ tests/ alembic/

typecheck-backend:
	mypy virtual_team/ --ignore-missing-imports

docker-up:
	docker compose -f config/docker/docker-compose.yml up -d

docker-build:
	docker compose -f config/docker/docker-compose.yml build

docker-down:
	docker compose -f config/docker/docker-compose.yml down

docker-logs:
	docker compose -f config/docker/docker-compose.yml logs -f

clean:
	rm -rf frontend/dist frontend/node_modules
