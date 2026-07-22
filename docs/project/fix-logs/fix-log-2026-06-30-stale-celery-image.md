# 修复日志：GitHub Actions Docker 缓存导致 `celery:latest` 镜像未更新

> 模板来源：`docs/sdlc/补充-fix-log-template.md`

---

## Part A — 基本信息

| 字段 | 内容 |
|------|------|
| 标题 | GitHub Actions Docker 缓存导致 `celery:latest` 镜像未更新 |
| 修复编号 | FIX-20260630-005 |
| 关联缺陷 | FIX-20260630-004（代码修复已上线但 celery 镜像未更新导致仍报错） |
| 日期 | 2026-06-30 |
| 作者 | Sisyphus |
| 涉及模块 | `.github/workflows/deploy.yml`、`docker/compose.prod.yml`、`docker/compose.local.yml` |
| 影响范围 | 生产环境 Celery worker |
| 触发条件 | `Build & Deploy` workflow 运行后，Celery 容器仍使用旧镜像 |

---

## Part B — 根因分析

### 2.1 问题现象

代码修复（FIX-20260630-002、FIX-20260630-004）已合并到 `main` 并通过 CI，`Build & Deploy` 显示成功，但生产环境 Celery worker 仍报 `PostgresSaver` 不存在（旧代码），而 API backend 已正常运行新代码。检查发现运行的 Celery 镜像 `cacc167a2fec` 构建于 `14:46`（旧），API 镜像 `cf039d4222c8` 构建于 `17:01`（新）。

### 2.2 根本原因

**一句话概括**：`docker/build-push-action@v6` 在构建 `celery:latest` 时复用 `backend:latest` 的所有缓存层（两者使用相同 Dockerfile），推送时 ACR 上的 `celery:latest` 标签未被更新。

Docker BuildKit 检测到 backend 和 celery 的 Dockerfile 及构建上下文完全相同，复用所有缓存层。生成的镜像内容与 backend 一致（SHA 相同），但推送到 ACR 时标签可能未刷新。

### 2.3 数据流溯源

```
GitHub Actions Build & Deploy:
  Step 1: Build & push backend
    → 使用 Dockerfile 构建 → 层 A, B, C（新代码）
    → push → ACR 上 backend:latest 更新 ✅
  
  Step 2: Build & push celery
    → 复用 Step 1 的所有缓存层（Dockerfile 相同）
    → push → ACR 上 celery:latest 可能未更新 ❌
    （因为层哈希与 backend 相同，Docker 跳过推送）

  生产服务器 docker compose pull:
    → 拉取 backend:latest ✅（新镜像）
    → 拉取 celery:latest ❌（仍指向旧镜像）
```

### 2.4 为什么之前没发现

| 原因 | 说明 |
|------|------|
| 之前的代码改动不涉及 celery | 之前部署时 backend/celery 镜像功能未拆分 |
| 首次引入此问题 | FIX-20260630-002/004 是首次修改运行时 Docker 内容 |

---

## Part C — 修复方案

### 3.1 修复策略

**立即修复**：手动用 `backend:latest` 镜像启动 Celery 容器（两镜像使用同一 Dockerfile，内容一致）。

**永久修复**：修改 `docker-compose` 配置，使 Celery 服务直接使用 `backend:latest` 镜像，彻底消除两个独立标签导致的不同步风险。

### 3.2 修改清单

| # | 文件 | 变更说明 |
|---|------|---------|
| 1 | `docker/compose.prod.yml` | celery 服务 `image:` 改为指向 `backend:latest` |
| 2 | `docker/compose.local.yml` | 同上对齐 |
| 3 | 服务器手动执行 | `docker rm -f agent-studio-worker-prod` + `docker compose up -d` |

### 3.3 关键代码 diff

```diff
  celery:
-   image: crpi-.../celery:latest
+   # 使用 backend 镜像 — 两者同一 Dockerfile，backend 始终最新
+   image: crpi-.../backend:latest
```

---

## Part D — 复盘总结

### 4.1 经验教训

同一 Dockerfile 构建出内容完全一致的镜像，但推送到不同 ACR 标签时，可能因层缓存导致部分标签未刷新。避免为相同 Dockerfile 维护多个独立镜像标签。

### 4.2 改进措施

| # | 措施 | 责任人 |
|---|------|--------|
| 1 | 相同 Dockerfile 的服务共享同一镜像标签 | Sisyphus |
| 2 | `compose.local.yml` 与 `compose.prod.yml` 保持一致配置 | Sisyphus |

### 4.3 关联问题

FIX-20260630-004（受此问题影响的代码修复）。
