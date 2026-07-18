# RUNBOOK — Virtual Team Operations

> Production operations manual for the AgentStudio multi-agent platform.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Database](#database)
- [Backup & Restore](#backup--restore)
- [Monitoring & Alerting](#monitoring--alerting)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)
- [Rollback](#rollback)
- [Security](#security)

---

## Architecture Overview

```
                    ┌──────────────┐
                    │   Frontend   │  nginx SPA (port 80/5173)
                    │  React + Vite│
                    └──────┬───────┘
                           │ HTTP/WS
                    ┌──────▼───────┐
                    │   Backend    │  FastAPI (port 8080)
                    │  uvicorn     │
                    └──┬───────┬───┘
                       │       │
              ┌────────▼──┐ ┌──▼────────┐
              │  Postgres │ │   Redis   │
              │  pg16     │ │  7-alpine │
              │  +vector  │ │  pub/sub  │
              └───────────┘ └───────────┘
                       │
              ┌────────▼──┐
              │  Celery   │  async task workers
              │  Worker   │  (pool=threads)
              └───────────┘
```

### Components

| Component | Role | Port | Image |
|-----------|------|------|-------|
| **postgres** | Primary DB (pgvector) | 5432 | `pgvector/pgvector:pg16` |
| **redis** | Cache, pub/sub stream, Celery broker | 6379 | `redis:7-alpine` |
| **backend** | FastAPI HTTP + WebSocket server | 8080 | `virtual-team/backend` |
| **celery** | Async task worker (graph execution) | — | `virtual-team/backend` (same image) |
| **frontend** | nginx + React SPA | 80 | `virtual-team/frontend` |

### Data Flow

1. User sends message → Frontend WebSocket → Backend
2. Backend creates `Run`, streams via `StreamEmitter` → Redis pub/sub → WebSocket
3. Long-running graph execution offloaded to **Celery** worker
4. Checkpoints saved to **Postgres** via `Checkpointer`
5. Observability events (traces, errors) written to **SQLite** EventStore

---

## Deployment

### Prerequisites

- Docker & Docker Compose v2
- Access to Alibaba Cloud Container Registry (ACR) — `crpi-j0fhvkobexa3ilkn.cn-shenzhen.personal.cr.aliyuncs.com`
- Production server with Docker Engine

### Deploy from CI

Push to `main` triggers `.github/workflows/deploy.yml`:

1. Build & push images to ACR
2. SCP `docker/`, `frontend/Dockerfile`, `frontend/nginx.conf`, `.env.example` to server
3. SSH into server, `docker compose pull && up -d --force-recreate`

### Manual Deploy

```bash
# On the production server
cd /opt/virtual-team

# Pull latest images
docker compose -f docker/compose.prod.yml pull

# Recreate containers
docker compose -f docker/compose.prod.yml up -d --force-recreate

# Check status
docker compose -f docker/compose.prod.yml ps
```

### First-Time Setup

```bash
# 1. Clone repo on server
git clone <repo-url> /opt/virtual-team
cd /opt/virtual-team

# 2. Create .env from example
cp .env.example .env
# Edit .env — set at minimum: DEEPSEEK_API_KEY, KEY_VAULT_SECRET, AUTH_SECRET

# 3. Start stack
docker compose -f docker/compose.prod.yml up -d

# 4. Verify
curl http://localhost:8080/api/health
curl http://localhost:5173/
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | ✅ | — | LLM provider API key |
| `KEY_VAULT_SECRET` | ✅ | — | Fernet key for API key encryption (≥32 bytes) |
| `AUTH_SECRET` | ✅ | — | JWT signing secret |
| `DATABASE_URL` | — | `postgresql+asyncpg://postgres:postgres@postgres:5432/backend` | Postgres connection string |
| `REDIS_URL` | — | `redis://redis:6379/0` | Redis connection string |
| `OPENAI_BASE_URL` | — | `https://api.deepseek.com` | LLM API base URL |
| `OPENAI_MODEL` | — | `deepseek-v4-flash` | LLM model name |
| `AUTH_MODE` | — | `legacy` | `legacy` (fixed admin) or `rbac` (JWT + roles) |
| `AUTH_ENABLED` | — | `1` | Set to `0` to disable auth entirely |
| `LOG_LEVEL` | — | `INFO` | Python log level |
| `CHECKPOINTER_BACKEND` | — | `postgres` | `memory`, `sqlite`, or `postgres` |
| `CORS_ORIGIN` | — | `http://localhost:80` | Frontend URL for CORS |
| `RATE_LIMIT` | — | `60` | Max requests per window |
| `RATE_LIMIT_WINDOW` | — | `60` | Rate limit window in seconds |
| `EMAIL_BACKEND` | — | `log` | `log` (dev) or `smtp` (production) |
| `GC_INTERVAL` | — | `3600` | Session GC interval in seconds |

See `.env.example` for the full list with comments.

### Docker Compose Profiles

| File | Use Case |
|------|----------|
| `docker/compose.local.yml` | Local development — builds from source |
| `docker/compose.prod.yml` | Production — pulls prebuilt images from ACR |

---

## Database

### Connection

```bash
# Inside the container
docker exec -it virtual-team-db-prod psql -U postgres -d backend

# From host (if port exposed)
psql -h localhost -U postgres -d backend
```

### Migrations (Alembic)

```bash
# Apply all pending migrations
PYTHONPATH=. alembic upgrade head

# Rollback one step
PYTHONPATH=. alembic downgrade -1

# Rollback to a specific revision
PYTHONPATH=. alembic downgrade <revision_id>

# Create a new migration (autogenerate)
PYTHONPATH=. alembic revision --autogenerate -m "description"

# View history
PYTHONPATH=. alembic history

# View current revision
PYTHONPATH=. alembic current
```

Migrations run **automatically** on container startup via `scripts/docker-entrypoint.sh`.

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sessions` | Chat sessions | `id`, `title`, `user_id` |
| `project_runs` | Graph execution runs | `id`, `session_id`, `status`, `config` |
| `chat_messages` | Message history | `id`, `run_id`, `role`, `content` |
| `memory_entries` | Agent memory / checkpoints | `id`, `session_id`, `checkpoint_id` |
| `user_api_keys` | Encrypted user API keys | `id`, `user_id`, `encrypted_key`, `provider` |
| `agent_configs` | Agent definitions | `id`, `name`, `system_prompt`, `provider` |
| `teams` | Agent team configurations | `id`, `name`, `description` |
| `workflow_configs` | Workflow DAG definitions | `id`, `team_id`, `max_rounds` |
| `users` | User accounts (auth) | `id`, `email`, `hashed_password` |

### Schema Migrations Lifecycle

1. Developer creates migration: `alembic revision --autogenerate`
2. Reviewed in PR
3. CI validates: `alembic upgrade head` then `alembic downgrade -1` then `alembic upgrade head`
4. Migration runs on deploy via `docker-entrypoint.sh`

---

## Backup & Restore

### Postgres Backup

```bash
# Full backup (daily recommended)
docker exec virtual-team-db-prod pg_dump -U postgres -d backend \
  | gzip > /backups/virtual-team-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore from backup
gunzip -c /backups/virtual-team-20260401-120000.sql.gz | \
  docker exec -i virtual-team-db-prod psql -U postgres -d backend
```

For Alibaba Cloud RDS or similar managed Postgres, use the cloud provider's native snapshot/backup mechanism.

### Redis Backup

```bash
# Trigger BGSAVE manually
docker exec virtual-team-redis-prod redis-cli BGSAVE

# Redis dump location (mounted volume)
# /data/dump.rdb
```

Redis data is ephemeral — it caches session state and pub/sub messages. Loss only degrades in-flight streams (not persisted data).

### Checkpoint Backup

```bash
# Checkpoint data lives in the backend's Docker volume
docker run --rm -v virtual-team-prod_checkpoint_data:/data -v /backups:/backups \
  alpine tar czf /backups/checkpoints-$(date +%Y%m%d).tar.gz -C /data .
```

### Backup Schedule (Recommended)

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Postgres (full) | Daily | 30 days | `pg_dump` → compressed file |
| Postgres (WAL) | Continuous | 7 days | archive_mode or RDS native |
| Redis dump | Hourly | 24 hours | `BGSAVE` → volume backup |
| Checkpoints | Daily | 7 days | Volume tarball |
| Docker volumes | Weekly | 4 weeks | `tar` of named volumes |

---

## Monitoring & Alerting

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Basic health check (returns DB + Redis status) |
| `GET /api/metrics` | Prometheus RED metrics |
| `GET /api/debug/health` | Observability store health |
| `GET /api/debug/events` | Recent observability events |
| `GET /api/debug/errors` | Recent error reports |
| `GET /api/debug/stats` | Event counts by severity |

### Prometheus Metrics

Available at `/api/metrics`:

- `http_requests_total` — Request count (labels: method, endpoint, status)
- `http_request_duration_seconds` — Latency histogram (labels: method, endpoint)
- `http_requests_in_progress` — Concurrent request gauge

### Docker Healthchecks

All services have built-in Docker HEALTHCHECK:

| Service | Check | Interval | Timeout | Retries |
|---------|-------|----------|---------|---------|
| postgres | `pg_isready` | 5s | 5s | 5 |
| redis | `redis-cli ping` | 5s | 5s | 5 |
| backend | `GET /api/models` HTTP | 15s | 5s | 3 |
| celery | `celery inspect ping` | 30s | 10s | 3 |
| frontend | `wget --spider /` on port 80 | 15s | 5s | 3 |

### Logging

- **Docker logs**: `docker compose logs --tail=100 -f [service]`
- **Log driver**: `json-file` with `max-size=10m`, `max-file=3`
- **Level**: Configure via `LOG_LEVEL` env var

### Alerting Rules (Sample Prometheus Alerts)

```yaml
# HTTP 5xx rate too high
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 5m
  labels: { severity: critical }
  annotations:
    summary: "HTTP 5xx error rate {{ $value | humanizePercentage }}"

# Backend unreachable
- alert: BackendDown
  expr: up{job="backend"} == 0
  for: 1m
  labels: { severity: critical }

# High latency
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5
  for: 5m
  labels: { severity: warning }
```

### Key Metrics to Watch

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU usage (backend) | > 70% | > 90% | Scale up or investigate |
| Memory (backend) | > 70% | > 90% | Check for leaks, restart |
| Disk (Postgres) | > 80% | > 90% | Extend volume, prune old data |
| Response time p95 | > 3s | > 5s | Check DB queries, LLM latency |
| Error rate (5xx) | > 1% | > 5% | Check logs, rollback if needed |

---

## Scaling

### Vertical Scaling (Single Server)

Increase `mem_limit` / `mem_reservation` in `docker/compose.prod.yml`:
- **backend**: Up to 4 GB for heavy LLM workloads
- **celery**: Increase `--concurrency` (default: 2) based on CPU cores
- **postgres**: Adjust `DATABASE_POOL_SIZE` / `DATABASE_POOL_OVERFLOW` in `.env`

### Horizontal Scaling (Multi-Server)

The architecture supports horizontal scaling with a shared Postgres + Redis:

1. **Stateless backend**: Run multiple backend containers behind a load balancer
2. **Celery workers**: Scale worker containers independently
3. **Frontend**: Multiple nginx instances behind a reverse proxy
4. **Session affinity**: WebSocket connections require sticky sessions to avoid reconnect overhead

### Resource Limits (Production Defaults)

| Service | Memory Limit | Memory Reservation | CPU |
|---------|-------------|-------------------|-----|
| postgres | 512 MB | 256 MB | Unbounded |
| redis | 256 MB | 128 MB | Unbounded |
| backend | 1 GB | 512 MB | Unbounded |
| celery | 2 GB | 1 GB | Unbounded |
| frontend | 512 MB | 256 MB | Unbounded |

---

## Troubleshooting

### Common Issues

#### Backend won't start

```bash
# Check logs
docker compose logs backend

# Verify Postgres connectivity
docker exec virtual-team-api-prod pg_isready -h postgres -U postgres

# Check migration status
docker exec virtual-team-api-prod alembic current

# Force re-run migrations
docker exec virtual-team-api-prod alembic upgrade head
```

#### API returns 502 / upstream timeout

```bash
# Long-running graph operations may exceed nginx proxy_read_timeout
# Check nginx.conf — currently set to 120s for API, 86400s for WS
# Increase proxy_read_timeout in frontend/nginx.conf if needed

# Check if celery worker is alive
docker exec virtual-team-worker-prod celery -A backend.broker.celery_app inspect ping
```

#### Celery tasks not executing

```bash
# Check Redis connectivity
docker exec virtual-team-redis-prod redis-cli ping

# Check celery worker logs
docker compose logs celery

# Restart celery worker
docker compose restart celery
```

#### Out of memory

```bash
# Check current usage
docker stats

# Reduce celery --concurrency or increase mem_limit
# Reduce MAX_RETRIES / TIMEOUT in .env
```

#### WebSocket disconnections

```bash
# Check nginx WebSocket timeout (86400s = 24h, should be fine)
# Check frontend reconnection logic
# Redis pub/sub may buffer messages — restarting Redis loses in-flight streams
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=DEBUG docker compose -f docker/compose.prod.yml up -d

# Dump observability events
curl http://localhost:8080/api/debug/events?limit=100

# Trace a specific request
curl http://localhost:8080/api/debug/trace/{trace_id}

# Recent errors
curl http://localhost:8080/api/debug/errors
```

---

## Rollback

### Via GitHub Actions

1. Go to Actions → Rollback workflow
2. Input the target version/tag (e.g., `v1.2.3` or `main`)
3. Run — deploys specified version to production

### Manual Rollback

```bash
# Pull a specific tagged version
docker pull crpi-j0fhvkobexa3ilkn.cn-shenzhen.personal.cr.aliyuncs.com/virtual-team/backend:<tag>
docker pull crpi-j0fhvkobexa3ilkn.cn-shenzhen.personal.cr.aliyuncs.com/virtual-team/frontend:<tag>

# Update compose file to use the tag, then recreate
export BACKEND_TAG=<tag>
docker compose -f docker/compose.prod.yml up -d --force-recreate
```

### Database Rollback

```bash
# Rollback the last migration
PYTHONPATH=. alembic downgrade -1

# Rollback to a specific revision (for revert deployment)
PYTHONPATH=. alembic downgrade <revision_id>
```

> **Always test DB rollback in CI before deploying.** A migration revert may be destructive — backup before rollback.

---

## Security

### Secret Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| `KEY_VAULT_SECRET` | `.env` + GitHub Secrets | On compromise |
| `AUTH_SECRET` | `.env` + GitHub Secrets | On compromise |
| `DEEPSEEK_API_KEY` | `.env` + GitHub Secrets | Quarterly or on compromise |
| User API keys | Fernet-encrypted in Postgres `user_api_keys` table | User-managed via UI |
| `SERVER_PASSWORD` | GitHub Secrets only | On SSO key rotation |

### Network Security

- Backend containers **do not expose ports** in production (`expose` only, no `ports`)
- Only frontend nginx binds to host port 5173
- Internal Docker network `virtual-team-prod` with dedicated subnet `172.28.0.0/16`
- Postgres and Redis not exposed to host in production

### CI/CD Security Checks

- **pip-audit**: Scans Python dependencies for known vulnerabilities (CI, non-blocking)
- **bandit**: SAST scan for Python security issues (CI, non-blocking)
- **npm audit**: Audits frontend dependencies for critical vulnerabilities (CI, blocking)
- **mypy strict**: Static type checking (CI, blocking)
- **Dependency review**: GitHub's `dependency-review-action` blocks known-vulnerable deps

### Access Control

- **AUTH_MODE=legacy**: Single admin account, no registration — suitable for internal/VPN-only deployments
- **AUTH_MODE=rbac**: JWT-based auth with role-based access control — for production with multiple users
- Rate limiting: Token-bucket via Redis, default 60 req/60s per IP

### Production Checklist

Before going to production:

- [ ] `KEY_VAULT_SECRET` set to a strong Fernet key (not the example default)
- [ ] `AUTH_SECRET` set to a unique random string
- [ ] `AUTH_MODE` set to `rbac` for multi-user scenarios
- [ ] Rate limiting enabled (default)
- [ ] CORS_ORIGIN set to the actual frontend domain
- [ ] EMAIL_BACKEND configured as `smtp` (not `log`)
- [ ] Postgres backups configured
- [ ] Monitoring/alerting configured
- [ ] SSL/TLS termination set up (reverse proxy or cloud LB)
- [ ] `LOG_LEVEL` set to `WARNING` in production
