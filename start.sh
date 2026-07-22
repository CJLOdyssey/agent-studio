#!/bin/bash
cd /home/odyssey/PyCharmProjects/Agent/projects/agent-studio
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/backend
export PYTHONPATH=.
exec /home/odyssey/.local/bin/uvicorn backend.core.app:app --port 8081
