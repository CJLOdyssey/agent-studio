# 修复日志：API Key 匿名 fallback 缺失导致 400/404

## 问题信息

| 字段 | 内容 |
|------|------|
| 问题编号 | BUG-20260702-001 |
| 问题来源 | 开发自测 |
| 所属阶段 | 编码 / 测试 |
| 问题级别 | 严重 |
| 发现日期 | 2026-07-02 |
| 发现人 | Sisyphus |

## 问题描述

Postman/WSL 前端发送消息时，`POST /api/runs` 返回 400 Bad Request。用户删除错配置的 API Key 时，`DELETE /api/keys/{id}` 返回 404 Not Found。

根本原因是 `get_api_keys()`（列表查询）有 anonymous fallback 逻辑，但 `get_api_key_for_use()`、`get_default_api_key()`、`delete_api_key()`、`update_api_key()` 没有。

## 影响范围

- 模块：`backend/repository/keys.py`
- 所有需要 Key 的操作：创建 run、编辑 key、删除 key
- 所有用户（因前端使用随机 X-User-ID）

## 根本原因

前端 `api/client/instance.ts` 在每个请求头注入随机的 `X-User-ID`，存于 localStorage。当 localStorage 被清除或跨标签页时，user_id 变化。

`get_api_keys()` 有 fallback（当前用户无 key 时显示 anonymous 用户的 key），但其他四个函数没有，导致：

1. `listKeys()` 返回了 key → 前端认为有 key → 发起 `POST /api/runs`
2. `get_api_key_for_use()` 用新 user_id 查不到 → 返回 None → 400
3. `delete_api_key()` 用新 user_id 查不到 → 返回 False → 404

## 修复方案

在 `get_api_key_for_use()`、`get_default_api_key()`、`delete_api_key()`、`update_api_key()` 中，当当前 user_id 查不到记录时，fallback 到 `"anonymous"` 用户。

### 改动文件

| 文件 | 改动 |
|------|------|
| `backend/repository/keys.py` | 4 个函数加 anonymous fallback：`get_api_key_for_use` 行首 fallback 查询、`get_default_api_key` 提取 `_resolve_key_row` 辅助函数、`delete_api_key` 加 owner_match/anonymous_fallback 判断、`update_api_key` 同上 |

## 验证方法

```bash
# 用不存在的 user_id 使用 anonymous 的 key → 应成功
curl -s -X POST /api/runs -H "X-User-ID: stranger" \
  -d '{"requirement":"test","key_id":"<anonymous-key-id>"}'

# 用不存在的 user_id 删除 anonymous 的 key → 应 200
curl -s -X DELETE /api/keys/<id> -H "X-User-ID: stranger"
```

## 备注

2026-07-02 | 已修复，验证通过 | Sisyphus
