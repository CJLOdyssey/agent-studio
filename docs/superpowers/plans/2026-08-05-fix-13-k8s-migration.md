# Fix 13: K8s 迁移并发 + 失败静默掩盖修复 Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p13 main -b fix/p13-k8s-migration`）。只修改本文件列出的文件。**禁碰 `docker/Dockerfile`（P14 独占）。**

**Goal:** alembic 迁移在独立 Job 中执行一次；后端多副本不再并发跑迁移；迁移失败 fail-fast 不再 `stamp head` 掩盖。
**Architecture:** entrypoint 支持 `SKIP_MIGRATIONS=1` 且失败改为 exit 1；新增 Helm Job 专跑 `alembic upgrade head`；Deployment 设 `SKIP_MIGRATIONS=1` 并将探针从 `/api/models` 改为 `/api/health`。
**Tech Stack:** Bash / Helm / Kubernetes

## 并行协调

- 独占文件：`scripts/dev/docker-entrypoint.sh`、`helm/templates/deployment-backend.yaml`、`helm/templates/job-migrate.yaml`（新）、`helm/values.yaml`
- 与 P14（Dockerfile）文件边界互补

## Global Constraints

- 不修改其它方案的独占文件
- Docker compose 路径（非 K8s）行为不变：entrypoint 默认仍执行迁移（无 SKIP_MIGRATIONS 时）
- 提交遵循 .gitmessage 格式

---

## 根因

① `helm/templates/deployment-backend.yaml:35` 以 entrypoint 跑 `alembic upgrade`，默认 2 副本（`values.yaml:60`）同时启动 → 迁移竞争。② `scripts/dev/docker-entrypoint.sh:32-38` 迁移失败自动 `alembic stamp head` → 真失败被盖章跳过，数据不一致风险。③ liveness/readiness 探针打 `/api/models`（依赖 DB），DB 抖动引发 crash-loop。

## Files

- Modify: `scripts/dev/docker-entrypoint.sh`（L32-38）
- Modify: `helm/templates/deployment-backend.yaml`（加 SKIP_MIGRATIONS + 探针）
- Create: `helm/templates/job-migrate.yaml`
- Modify: `helm/values.yaml`（migrations 段）

---

- [ ] **Step 1: entrypoint.sh 改 fail-fast + SKIP_MIGRATIONS**

```bash
# ── 2. Run Alembic migrations (skipped when SKIP_MIGRATIONS=1; K8s 由独立 Job 执行) ──
if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo "⏭️ SKIP_MIGRATIONS=1 — skipping alembic migrations"
else
  echo "🚀 Running alembic migrations..."
  if ! alembic upgrade head; then
    echo "❌ Migration failed — refusing to start backend"
    exit 1
  fi
  echo "✅ Migrations applied"
fi
```

- [ ] **Step 2: 创建 `helm/templates/job-migrate.yaml`**

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "agent-studio.fullname" . }}-migrate
  labels:
    {{- include "agent-studio.labels" . | nindent 4 }}
    component: migrate
spec:
  backoffLimit: 3
  ttlSecondsAfterFinished: 86400
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          image: {{ include "agent-studio.backend.image" . }}
          imagePullPolicy: {{ .Values.backend.image.pullPolicy | default "IfNotPresent" }}
          command: ["alembic", "upgrade", "head"]
          envFrom:
            - configMapRef:
                name: {{ include "agent-studio.fullname" . }}-config
            - secretRef:
                name: {{ include "agent-studio.fullname" . }}-secret
          resources:
            {{- toYaml .Values.migrations.resources | nindent 12 }}
          securityContext:
            allowPrivilegeEscalation: {{ .Values.securityContext.allowPrivilegeEscalation }}
            runAsNonRoot: {{ .Values.securityContext.runAsNonRoot }}
            runAsUser: {{ .Values.securityContext.runAsUser }}
            runAsGroup: {{ .Values.securityContext.runAsGroup }}
            capabilities:
              {{- toYaml .Values.securityContext.capabilities | nindent 14 }}
```

- [ ] **Step 3: deployment-backend.yaml 加 SKIP_MIGRATIONS + 修探针**

envFrom 之后追加：

```yaml
          env:
            - name: SKIP_MIGRATIONS
              value: "1"
```

liveness/readiness 探针路径 `/api/models` → `/api/health`（避免 DB 抖动触发 crash-loop）：

```yaml
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
```

- [ ] **Step 4: values.yaml 加 migrations 段**

```yaml
migrations:
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi
```

- [ ] **Step 5: 验证**

```bash
helm template agent-studio ./helm > /tmp/rendered.yaml && grep -A2 "SKIP_MIGRATIONS" /tmp/rendered.yaml
# 期望：deployment 有 SKIP_MIGRATIONS=1；出现 kind: Job 的 migrate 资源；backend 探针 /api/health
```

> ⚠️ **风险（行为变更）**：移除 entrypoint 的 `stamp head` 兜底后，若既有 DB 由 `init_db()` 的 `create_all` 建表（schema 与 alembic 基线有漂移），`alembic upgrade head` 可能失败 → 容器拒启。上线前需在测试环境确认「create_all 库 + alembic upgrade head」可成功（必要时先 `alembic stamp head` 一次对齐基线再切 fail-fast）。

- [ ] **Step 6: Commit**

```bash
git add scripts/dev/docker-entrypoint.sh helm/templates/deployment-backend.yaml \
        helm/templates/job-migrate.yaml helm/values.yaml
git commit -m "fix(helm): run alembic in dedicated Job, fail-fast entrypoint, decouple probes from DB"
```

## Self-Review

- 非 K8s（Docker compose）路径：无 `SKIP_MIGRATIONS` → entrypoint 仍跑迁移，且现在失败会 fail-fast（行为收紧，符合预期）
- Job 用同一 backend 镜像与 envFrom，迁移连接与 Deployment 一致
- 探针改为 `/api/health`（observability 自诊断端点），不再依赖 DB
