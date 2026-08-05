# Fix 14: 后端镜像多阶段 + 生产依赖拆分 Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p14 main -b fix/p14-docker`）。只修改本文件列出的文件。**禁碰 `ci.yml` 与 `pyproject.toml`（P5/P6/P8 独占）。**

**Goal:** 生产镜像只装运行时依赖，构建走多阶段；`requirements.txt` 去重并 pin `pyjwt`（P4 依赖）。
**Architecture:** 新增 `requirements-prod.txt`（仅运行时依赖），`docker/Dockerfile` 改多阶段（builder 装 prod 依赖 → runtime 拷贝）；`requirements.txt` 保持全量 lock 供 CI/dev 使用（零 ci.yml 影响）。
**Tech Stack:** Docker / Python 3.12

## 并行协调

- 独占文件：`requirements.txt`、`requirements-prod.txt`（新）、`docker/Dockerfile`、`.dockerignore`
- **P4 依赖**：`pyjwt` 由本方案 pin 进 requirements.txt（P4 本地 `pip install pyjwt`）；**本方案先于 P4 merge**
- 禁碰 ci.yml（CI 继续 `pip install -r requirements.txt` 全量）

## Global Constraints

- 不修改其它方案的独占文件
- CI/dev 的 `pip install -r requirements.txt` 行为不变（保持全量 lock）
- 生产镜像中 `import mypy` 必须失败、`import jwt/fastapi/celery` 必须成功
- 提交遵循 .gitmessage 格式

---

## 根因

`docker/Dockerfile`（单阶段）`RUN pip install -r requirements.txt` 把 mypy/pytest/bandit/pip-audit 等 dev 依赖装入生产镜像（`requirements.txt:14,19-21,31,34-45`）；`requirements.txt:24` 的 `httpx==0.28.1` 重复；P4 的 `pyjwt` 未 pin。

## Files

- Modify: `requirements.txt`（去重、修正头注释、加 pyjwt）
- Create: `requirements-prod.txt`
- Modify: `docker/Dockerfile`（多阶段）
- Modify: `.dockerignore`

---

- [ ] **Step 1: requirements.txt 修正**

删除重复的 `httpx==0.28.1`（第 24 行）；头注释 `# requirements-lock.txt` 改回 `# requirements.txt — 精确版本锁定文件`；追加：

```
pyjwt==2.10.1
```

- [ ] **Step 2: 创建 requirements-prod.txt（仅运行时依赖）**

```
aiosqlite==0.22.1
alembic==1.18.4
asyncpg==0.31.0
bcrypt==5.0.0
celery==5.6.3
cryptography==49.0.0
email-validator==2.3.0
fastapi==0.136.3
httpx==0.28.1
langchain-core==1.4.8
langchain-openai==1.2.2
langchain==1.3.11
langgraph-checkpoint-postgres==3.1.0
langgraph-checkpoint-sqlite==3.1.0
langgraph==1.2.6
mcp==1.28.1
pgvector==0.4.2
prometheus-client==0.25.0
psycopg2-binary==2.9.12
pydantic==2.13.4
pyjwt==2.10.1
python-multipart==0.0.31
pyyaml==6.0.1
redis==7.4.0
sqlalchemy==2.0.49
uvicorn==0.47.0
websockets==15.0.1
```

> 已剔除 dev/测试依赖（bandit/diff-cover/factory-boy/mypy/pip-audit/pre-commit/pytest*/ruff/types-*）。`dashscope` 亦剔除（源码 0 import 点，疑似过期；如需可后续加回）。

- [ ] **Step 3: docker/Dockerfile 改多阶段**

> ⚠️ 基准事实（已核验当前 `docker/Dockerfile`）：现有文件含 **PIP 清华镜像 ARG**（`PIP_INDEX_URL`/`PIP_TRUSTED_HOST`，海外需 `--build-arg` 覆盖）、`COPY scripts/ scripts/` 整目录、`COPY scripts/dev/health.py scripts/health.py`、用户组为 **`appgroup`**。**多阶段改造必须全部保留，不得删镜像 ARG（否则中国用户拉依赖失败）。** 以下为结构基准，逐段对照现有文件改：

```dockerfile
# Build args for pip mirror (default: Tsinghua mirror for China users)
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

# ── Stage 1: builder ──
FROM python:3.12-slim AS builder
ARG PIP_INDEX_URL
ARG PIP_TRUSTED_HOST
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements-prod.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements-prod.txt \
    --index-url ${PIP_INDEX_URL} --trusted-host ${PIP_TRUSTED_HOST}

# ── Stage 2: runtime ──
FROM python:3.12-slim
ARG PIP_INDEX_URL
ARG PIP_TRUSTED_HOST
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
# pg_isready for entrypoint DB wait
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup -g 1000 && useradd -r -g appgroup -u 1000 -m appuser
WORKDIR /app
COPY --from=builder /install /usr/local
COPY backend/ backend/
COPY alembic.ini .
COPY backend/alembic/ alembic/
COPY scripts/ scripts/
COPY scripts/dev/health.py scripts/health.py
ENV PYTHONPATH=/app/backend/src
RUN mkdir -p /app/uploads /app/data && chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
ENTRYPOINT ["scripts/dev/docker-entrypoint.sh"]
CMD ["uvicorn", "core.app:app", "--host", "0.0.0.0", "--port", "8080"]
```

> 说明：builder 需 `gcc` 编译 wheel（如有 sdist），runtime 只留 `postgresql-client`（entrypoint 的 `pg_isready`）；`appgroup`/`health.py`/镜像 ARG 与现有文件完全一致。

- [ ] **Step 4: .dockerignore 增加本地残留**

确认 `.dockerignore` 含：`.venv`, `__pycache__`, `*.db`, `uploads`, `docs`, `.idea`, `.mypy_cache`, `.pytest_cache`, `node_modules`；补 `index.html`, `script.js`, `styles.css`, `node_trace*.log`（根目录原型残留，避免 context 传输）。

- [ ] **Step 5: 验证**

```bash
docker build -f docker/Dockerfile -t agent-studio-backend:test . 2>&1 | tail -15
docker run --rm agent-studio-backend:test python -c "import mypy, pytest" 2>&1 | tail -2
# 期望：import mypy/pytest 报 ModuleNotFoundError（dev 依赖不在生产镜像）
docker run --rm agent-studio-backend:test python -c "import fastapi, celery, jwt" 2>&1
# 期望：正常 import（运行时依赖齐全，jwt=pyjwt）
```

- [ ] **Step 6: Commit**

```bash
git add requirements.txt requirements-prod.txt docker/Dockerfile .dockerignore
git commit -m "build(docker): multi-stage backend image with prod-only deps"
```

## Self-Review

- CI/dev 仍用全量 `requirements.txt`，零 ci.yml 改动，与 P6/P8 无冲突
- `pyjwt` 进入 requirements.txt 与 requirements-prod.txt，满足 P4 运行期依赖
- runtime 镜像仅 postgresql-client 系统包（entrypoint pg_isready 所需），无 gcc/libpq-dev
- `requirements-prod.txt` 与 `requirements.txt` 存在轻微漂移风险，已在头注释注明两处需同步维护（follow-up：迁移 pyproject `[project].dependencies` 单一声明源）
