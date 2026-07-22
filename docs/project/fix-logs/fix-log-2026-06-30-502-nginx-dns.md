# 修复日志：生产环境 502 Bad Gateway — nginx DNS 缓存导致 backend 不可达

> 模板来源：`docs/sdlc/补充-fix-log-template.md`

---

## Part A — 基本信息

| 字段 | 内容 |
|------|------|
| 标题 | 生产环境 502 Bad Gateway — nginx DNS 缓存导致 backend 不可达 |
| 修复编号 | FIX-20260630-001 |
| 关联缺陷 | — |
| 日期 | 2026-06-30 |
| 作者 | Sisyphus |
| 涉及模块 | `docker/compose.prod.yml`、`frontend/nginx.conf`、服务器 nginx |
| 影响范围 | 所有生产环境 API 请求（前端无法与后端通信） |
| 触发条件 | Docker 容器重启后（backend 容器 IP 变更），nginx 缓存了旧的 DNS 解析 |

---

## Part B — 根因分析

### 2.1 问题现象

前端页面加载正常（静态资源通过 nginx 缓存），但所有 API 请求返回 502 Bad Gateway。浏览器控制台显示 `POST /api/runs` 等请求失败。

### 2.2 根本原因

**一句话概括**：nginx 在启动时 DNS 解析 `backend` 主机名并缓存结果，当 backend Docker 容器因 `docker compose up -d --force-recreate` 重建后 IP 变更，nginx 仍连接到旧的 IP 地址，导致连接失败。

Docker Compose 默认使用 Docker 内置 DNS（`127.0.0.11`），容器名 `backend` 解析为容器 IP。但 nginx 在解析 `proxy_pass http://backend:8080` 中的 `backend` 时，仅启动时解析一次，之后一直使用缓存 IP。

### 2.3 数据流溯源

```
docker compose up -d --force-recreate
  → backend 容器 IP 从 172.28.0.5 变为 172.28.0.8
  → nginx 仍缓存 backend → 172.28.0.5
  → 用户请求 /api/xxx
  → nginx proxy_pass → http://172.28.0.5:8080（不存在）
  → 502 Bad Gateway
```

### 2.4 为什么之前没发现

| 原因 | 说明 |
|------|------|
| 首次部署无此问题 | 首次部署时 nginx 和 backend 同时启动，DNS 解析正常 |
| 仅容器重建触发 | 只有 backend 容器 IP 变更时才出现 |

---

## Part C — 修复方案

### 3.1 修复策略

在服务器上执行 `nginx -s reload`，使 nginx 重新加载配置并重新解析 DNS。

### 3.2 修改清单

| # | 操作 | 说明 |
|---|------|------|
| 1 | 服务器执行 `nginx -s reload` | 重新加载 nginx 配置，刷新 DNS 缓存 |

无代码变更。

### 3.3 长期预防

nginx 配置中 `proxy_pass` 使用变量形式可强制每次请求重新解析，但当前 `proxy_pass http://backend:8080` 的 Docker Compose 环境中，容器重建频率低，`nginx -s reload` 作为部署脚本的一环即可。

---

## Part D — 复盘总结

### 4.1 经验教训

nginx `proxy_pass` 使用固定主机名时，在解析阶段缓存 DNS，不会因后端容器 IP 变更而自动更新。

### 4.2 改进措施

| # | 措施 | 责任人 |
|---|------|--------|
| 1 | 在部署脚本 `docker compose up -d` 后增加 `nginx -s reload` | Sisyphus |

### 4.3 关联问题

无。
