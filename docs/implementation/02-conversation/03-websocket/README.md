---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：实时通信

> 领域：对话协作
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

WebSocket 连接管理、流式消息推送、Redis pub/sub。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | WebSocket 连接 | 01-websocket-connect.md | ⬜ |
| 2 | 流式消息推送 | 02-stream-message.md | ⬜ |
| 3 | 连接保活 | 03-heartbeat.md | ⬜ |
| 4 | 断线重连 | 04-reconnect.md | ⬜ |

---

## 涉及组件

| 组件 | 文件 |
|---|---|
| 前端 | `websocket.ts` |
| 后端 | `streaming.py`, `broker.py` |
| 路由 | `runs.py` (WebSocket endpoint) |

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 4 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
