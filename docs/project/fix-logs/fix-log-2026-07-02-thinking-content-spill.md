# 修复日志：思考文本泄漏到内容输出区

## 问题信息

| 字段 | 内容 |
|------|------|
| 问题编号 | BUG-20260702-003 |
| 问题来源 | 用户反馈 |
| 所属阶段 | 编码 |
| 问题级别 | 中等 |
| 发现日期 | 2026-07-02 |
| 发现人 | 用户 |

## 问题描述

模型思考内容（如「让我再搜索几个今天的热点话题」）出现在内容输出区域（ReactMarkdown）而非思考区域（ds-thinking-block）。表现为思考文本在内容区展示完成后强行追加。

## 影响范围

- `backend/agent_graph.py` — `_raw_llm_stream()`
- `frontend/src/components/agentstudio/TeamMessage.tsx`
- 所有使用 DeepSeek 流式 API 的对话

## 根本原因

### 数据流原因

DeepSeek SSE 流式输出中，`reasoning_content`（思考）和 `content`（正文）是两个独立字段。但 DeepSeek 有时在工具调用前将**思考文本同步输出到 `content` 字段**，时序如下：

```
chunk N:   reasoning_content: "让我再搜索几个..." → thinking_stream ✅
chunk N+1: content: "让我再搜索几个..."           → stream ❌（此刻 tool_calls 未到）
chunk N+2: tool_calls: [{web_search}]             → map 才有值，晚了
```

### 渲染顺序原因

`TeamMessage.tsx` 中 `.ds-thinking-block` 是条件渲染的（`{(msg.thinking !== undefined) && (...)}`），ReactMarkdown 内容在 DOM 中先于 thinking block 渲染。当 thinking_stream 迟到时，thinking block 插入在 ReactMarkdown 之后。

## 修复方案

### 数据流修复（agent_graph.py）
工具调用前的 `content` 先缓存到 `_pending_content`，确认有 `tool_call` 就丢弃（思考回声），没 tool_call 才回放。

```python
_pending_content: list[str] = []
_tool_calls_seen = False

# content 到达
if _tool_calls_seen:
    content_chunks.append(content)     # 工具调用后：正常输出
    await cb(on_custom_token, content)
else:
    _pending_content.append(content)   # 工具调用前：缓存

# tool_call 到达
if tc_delta:
    _tool_calls_seen = True
    _pending_content.clear()           # 丢弃缓存（思考回声）

# 流结束
if _pending_content and not _tool_calls_seen:
    for chunk in _pending_content:     # 无工具调用时回放
        content_chunks.append(chunk)
        await cb(on_custom_token, chunk)
```

### 渲染顺序修复（TeamMessage.tsx）
`.ds-thinking-block` 容器改为始终渲染，内容条件填充，保证 DOM 位置在 ReactMarkdown 之上。

## 验证方法

发送带工具调用的消息（如「帮我搜索今天的AI新闻」），检查：
1. 思考区正确显示全部推理过程
2. 内容区无思考文本泄漏
3. 思考文本不会在内容显示后才出现

## 备注

2026-07-02 | 已修复，通过 DOM 时间戳验证 | Sisyphus
