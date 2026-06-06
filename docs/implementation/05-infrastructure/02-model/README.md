---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：模型管理

> 领域：基础设施
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

LLM 模型的列表、Provider 适配、选择绑定。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 获取模型列表 | 01-list-models.md | ⬜ |
| 2 | 获取 Provider 列表 | 02-list-providers.md | ⬜ |
| 3 | 绑定 Agent 模型 | 03-bind-model.md | ⬜ |

---

## 支持的 Provider

| Provider | 基础 URL |
|---|---|
| OpenAI | https://api.openai.com/v1 |
| Azure | 用户自定义 |
| DeepSeek | https://api.deepseek.com/v1 |
| 本地 | http://localhost:11434/v1 |

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 3 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
