FROM python:3.12-slim

WORKDIR /app

# System deps (pg_isready for healthcheck, libpq-dev for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Python deps (layer cached independently of source code)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY virtual_team/ virtual_team/
COPY alembic.ini .
COPY alembic/ alembic/
COPY scripts/ scripts/

# PYTHONPATH so "from virtual_team import ..." works
ENV PYTHONPATH=/app

EXPOSE 8080

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
CMD ["uvicorn", "virtual_team.app:app", "--host", "0.0.0.0", "--port", "8080"]
