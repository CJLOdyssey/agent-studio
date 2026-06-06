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
	docker compose -f config/docker/docker-compose.yml up -d

docker-build:
	docker compose -f config/docker/docker-compose.yml build

docker-down:
	docker compose -f config/docker/docker-compose.yml down

docker-logs:
	docker compose -f config/docker/docker-compose.yml logs -f

clean:
	rm -rf frontend/dist frontend/node_modules
