.PHONY: dev build test lint typecheck format clean docker-up docker-build docker-down docker-logs

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

docker-up:
	docker compose up -d

docker-build:
	docker compose build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

clean:
	rm -rf frontend/dist frontend/node_modules
