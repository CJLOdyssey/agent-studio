# ADR 003: SQLite for the Observability EventStore

**Status**: Accepted

## Context

The observability subsystem (`backend/observability/`) captures agent execution traces, errors, and performance metrics for debugging. We needed a storage backend for the `EventStore` that supports high write throughput during agent runs, simple local setup, and zero external dependencies for the Debug API (`GET /api/debug/{events,trace,errors,stats,health}`). We evaluated PostgreSQL (our primary application database), dedicated time-series databases (InfluxDB, TimescaleDB), and SQLite.

## Decision

We chose **SQLite** with a background writer pattern. The `EventStore` (`backend/observability/store.py`) buffers events in memory and flushes them to a local SQLite database via a dedicated writer thread. The Debug API reads directly from this SQLite file.

Key reasons:
- **Zero setup**: No additional Docker service or configuration needed. SQLite is bundled with Python's standard library. This is critical for local development and single-node deployments.
- **Write isolation**: The background writer thread decouples agent execution (which emits events at high frequency) from disk I/O, preventing observability overhead from slowing down agent runs.
- **Appropriate scale**: Observability data is write-heavy but bounded — we retain only recent traces for debugging, not historical analytics. SQLite handles millions of rows comfortably for this scope.
- **Self-contained**: Each deployment gets its own `events.db` file. No shared database state to manage or migrate.

PostgreSQL was rejected for this subsystem because coupling observability writes to the transactional database would add latency and create a dependency loop (you can't debug database issues if errors are stored in the same database). Time-series databases were overkill — we don't need downsampling, retention policies, or distributed querying for debug traces.

## Consequences

- SQLite write contention under extreme load (>10K events/second) may require future migration to a dedicated timeseries store.
- Cross-instance observability aggregation (multi-node deployments) is not possible without additional tooling.
- Schema migrations for the events database must be handled manually or via simple version checks, unlike Alembic-managed application migrations.
