# .github/ci-image/Dockerfile
# Pre-built CI runner image for agent-studio CI jobs.
# Auto-built by ci-image-build.yml weekly or on dep changes.
# Uses python:3.12-slim (official) + Node.js from binary tarball
# to avoid nodesource apt repo timeouts.
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=22.23.1
ENV PATH="/usr/local/node/bin:${PATH}"

# Install system dependencies + Node.js from binary tarball (no apt repo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
      | tar -xJ -C /usr/local --strip-components=1 \
    && npm --version && node --version

# Pre-install Python dependencies
COPY requirements-lock.txt /tmp/
RUN pip install --no-compile -r /tmp/requirements-lock.txt --quiet
RUN pip install --no-compile playwright locust --quiet

# Pre-install Node dependencies
COPY frontend/package.json frontend/package-lock.json /tmp/frontend/
RUN cd /tmp/frontend && npm ci --prefer-offline --no-audit

# Pre-install Playwright browsers
RUN python3 -m playwright install chromium --with-deps

# Pre-warm mypy cache for backend
COPY backend/ /tmp/backend/
COPY pyproject.toml /tmp/
RUN cd /tmp && mypy --cache-dir /opt/mypy-cache backend/ --strict --no-error-summary || true
RUN rm -rf /tmp/backend /tmp/pyproject.toml

# Pre-build frontend to cache tsc + vite
COPY frontend/ /tmp/frontend-build/
WORKDIR /tmp/frontend-build
RUN npm run build 2>/dev/null || true
RUN npx tsc --noEmit 2>/dev/null || true
WORKDIR /
RUN rm -rf /tmp/frontend-build

# Cleanup
RUN rm -rf /tmp/requirements-lock.txt /tmp/frontend

WORKDIR /workspace
