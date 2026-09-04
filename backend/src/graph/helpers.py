"""单 Agent 引擎的模块级辅助函数。"""

import contextlib
from typing import Any

# 用于识别 API 计费失败（余额/额度不足）的错误关键词
_BALANCE_ERROR_KEYWORDS = [
    "insufficient_quota", "insufficient_balance", "insufficient balance", "余额不足",
    "billing limit", "quota exceeded", "payment required", "account balance", "402",
]


def is_balance_error(error_body: str) -> bool:
    """判断 API 错误响应是否表示余额/额度不足。"""
    body_lower = error_body.lower()
    return any(kw in body_lower for kw in _BALANCE_ERROR_KEYWORDS)


async def emit_balance_warning(stream_cb: Any) -> None:
    """通过流式回调向前端发送余额告警事件。"""
    if hasattr(stream_cb, "emit_balance_warning"):
        await stream_cb.emit_balance_warning(
            "模型余额不足，请检查 API Key 配置并确保账户有足够额度"
        )
    else:
        # 回退方案：以思考事件形式发送
        with contextlib.suppress(Exception):
            await stream_cb({
                "event": "on_custom_thinking",
                "data": {"content": "[warning] API 余额不足，请检查 API Key 配置"},
            })


def as_text(content: Any) -> str | None:
    """将 LangChain 消息 ``content``（字符串或多模态块列表）展平为纯文本。

    根 span 的 ``input_snapshot``/``output_snapshot`` 需要纯字符串；而
    ``HumanMessage.content`` / ``AIMessage.content`` 可能是字符串或块列表
    （如 ``[{"type":"text","text":"..."}]``）。为空时返回 ``None``。
    """
    if content is None:
        return None
    if isinstance(content, str):
        stripped = content.strip()
        return stripped or None
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"].strip())
        joined = "\n".join(p for p in parts if p).strip()
        return joined or None
    text = str(content).strip()
    return text or None
