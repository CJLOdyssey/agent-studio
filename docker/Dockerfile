# Build args for pip mirror (default: Tsinghua mirror for China users)
# Override for overseas: --build-arg PIP_INDEX_URL=https://pypi.org/simple --build-arg PIP_TRUSTED_HOST=pypi.org
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

FROM python:3.12-slim

WORKDIR /app

# System deps (pg_isready for healthcheck, libpq-dev for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Python deps (layer cached independently of source code)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    --index-url ${PIP_INDEX_URL} \
    --trusted-host ${PIP_TRUSTED_HOST}

# Copy project
COPY backend/ backend/
COPY alembic.ini .
COPY backend/alembic/ alembic/
COPY scripts/ scripts/

# PYTHONPATH so "from backend import ..." works
ENV PYTHONPATH=/app

# Run as non-root user for security
RUN groupadd -r appgroup -g 1000 && useradd -r -g appgroup -u 1000 -m appuser && \
    mkdir -p /app/uploads /app/data && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
CMD ["uvicorn", "backend.core.app:app", "--host", "0.0.0.0", "--port", "8080"]
