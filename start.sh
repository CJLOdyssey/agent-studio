#!/bin/bash
cd /home/odyssey/PyCharmProjects/Agent/projects/agent-studio
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/virtual_team
export PYTHONPATH=.
exec /home/odyssey/.local/bin/uvicorn virtual_team.core.app:app --port 8081
