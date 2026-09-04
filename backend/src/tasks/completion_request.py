"""按服务商能力路由的续写请求构建器——「继续生成」三档分流。

按 API base 能力路由续写：

- DeepSeek 官方（api.deepseek.com）：Chat 前缀补全（Beta）
  ``/beta/chat/completions`` + ``prefix: true`` + ``reasoning_content`` 前缀。
- Kimi（api.moonshot.cn、kimi-k2*）：部分模式——assistant 消息带
  ``partial: true``（+ ``thinking.keep: "all"`` 以带回思考）。
- 其他 OpenAI 兼容服务商（SiliconFlow 等）：通过标准化提示词模板
  做普通上下文续写。

三档都接收相同的规范化上下文——原始问题、被中断的回答草稿、被中断的
思考草稿——区别仅在传输机制（前缀 / 部分 / 提示词模板）。

纯函数——无 I/O，可轻松单元测试。
"""

from dataclasses import dataclass
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

DEEPSEEK_OFFICIAL_HOST = "api.deepseek.com"
MOONSHOT_HOST = "api.moonshot.cn"
DEFAULT_API_BASE = f"https://{DEEPSEEK_OFFICIAL_HOST}"

_MAX_TOKENS = 16384

# ── 标准化的续写上下文（模型能看到的输入） ──────────


@dataclass(frozen=True)
class ContinuationContext:
    """每一档都交给模型的规范化输入。

    question — 草稿所回答的原始用户消息。
    draft    — 被中断的回答文本（仅存在思考时为空）。
    thinking — 被中断的思考链（无思考时为空）。
    """

    question: str | None = None
    draft: str = ""
    thinking: str | None = None

    @property
    def has_draft(self) -> bool:
        return bool(self.draft.strip())

    @property
    def has_thinking(self) -> bool:
        return bool(self.thinking and self.thinking.strip())


# ── 标准化的任务指令（行为矩阵） ────────────────────────
# draft 有 → 继续补全回答文本；draft 空 + thinking 有 → 续推思考后出正文。

_CONTINUE_DRAFT_INSTRUCTION = (
    "Continue the following answer draft naturally. "
    "Output ONLY the continuation — no prefix, no analysis, no commentary, no meta-text. "
    "Do not repeat the draft text."
)

_CONTINUE_THINKING_INSTRUCTION = (
    "The answer text was not produced yet; the reasoning was interrupted. "
    "Continue the reasoning from where it stopped, then output the final answer text. "
    "Output ONLY the answer at the end — no meta-text, no repetition of the draft reasoning."
)


def _render_fallback_prompt(ctx: ContinuationContext) -> str:
    """为普通续写服务商渲染标准化提示词。

    当输入缺失时省略对应段落；任务指令遵循行为矩阵
    （存在 draft → 续写正文；否则续推思考后输出回答）。
    """
    parts: list[str] = []
    if ctx.question:
        parts.append(f"<用户问题>\n{ctx.question}")
    if ctx.has_draft:
        parts.append(f"<已生成的回答草稿>\n{ctx.draft}")
    if ctx.has_thinking:
        parts.append(f"<已生成的思考草稿>\n{ctx.thinking}")
    instruction = (
        _CONTINUE_DRAFT_INSTRUCTION
        if ctx.has_draft
        else _CONTINUE_THINKING_INSTRUCTION
    )
    parts.append(f"<任务>\n{instruction}")
    return "\n\n".join(parts)


# ── 请求类型 ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CompletionRequest:
    url: str
    headers: dict[str, str]
    body: dict[str, Any]


def build_completion_request(
    ctx: ContinuationContext,
    model: str | None,
    api_base: str | None,
    api_key: str,
) -> CompletionRequest:
    """按服务商能力路由构建续写请求（url、headers、body）。"""
    base = (api_base or DEFAULT_API_BASE).rstrip("/")
    effective_model = model or ""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    model_lower = effective_model.lower()

    if DEEPSEEK_OFFICIAL_HOST in base and ctx.has_thinking:
        return _deepseek_prefix_request(base, effective_model, ctx, headers)
    if MOONSHOT_HOST in base and ctx.has_thinking and "kimi-k2" in model_lower:
        return _kimi_partial_request(base, effective_model, ctx, headers)
    return _plain_continuation_request(base, effective_model, ctx, headers)


def _deepseek_prefix_request(
    base: str,
    model: str,
    ctx: ContinuationContext,
    headers: dict[str, str],
) -> CompletionRequest:
    """DeepSeek 官方 Chat 前缀补全（Beta）。

    Official contract: last message must be ``assistant`` with ``prefix: True``
    and its ``content`` set to the already-generated prefix; the user message
    carries the original question. Reasoning chain is passed back via
    ``reasoning_content`` for seamless continuation of thinking models.
    """
    clean_base = base.rstrip("/beta")
    body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "user", "content": ctx.question or "请继续完成下面的回答"},
            {
                "role": "assistant",
                "content": ctx.draft,
                "reasoning_content": ctx.thinking,
                "prefix": True,
            },
        ],
        "stream": True,
        "max_tokens": _MAX_TOKENS,
    }
    if "deepseek" in model.lower():
        body["thinking"] = {"type": "enabled"}
    return CompletionRequest(
        url=f"{clean_base}/beta/chat/completions",
        headers=headers,
        body=body,
    )


def _kimi_partial_request(
    base: str,
    model: str,
    ctx: ContinuationContext,
    headers: dict[str, str],
) -> CompletionRequest:
    """Kimi 部分模式（Prefill）：assistant 预填充 + 保留思考。

    当 draft 非空时，模型从预填充处续写；当 draft 为空（仅思考被中断）时，
    跳过预填充，由半构建的思考链驱动最终回答。
    """
    assistant: dict[str, Any] = {
        "role": "assistant",
        "content": ctx.draft,
        "partial": ctx.has_draft,
        "reasoning_content": ctx.thinking,
    }
    user_prompt = (
        "请自然续写以下内容：" if ctx.has_draft else "基于以下思考过程，直接输出最终回答正文："
    )
    body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "user", "content": ctx.question or user_prompt},
            assistant,
        ],
        "stream": True,
        "max_tokens": _MAX_TOKENS,
    }
    if "kimi-k2" in model.lower():
        body["thinking"] = {"type": "enabled", "keep": "all"}
    return CompletionRequest(
        url=f"{base}/chat/completions",
        headers=headers,
        body=body,
    )


def _plain_continuation_request(
    base: str,
    model: str,
    ctx: ContinuationContext,
    headers: dict[str, str],
) -> CompletionRequest:
    """通用回退：标准化提示词，无原生前缀机制。

    - 回答中途被中断：续写正文，禁用思考，使续写运行不会产生新的思考链，
      从而避免覆盖消息在 UI 中的思考。
    - 思考中途被中断：保持思考 ENABLED，使思考链在生成回答文本前从断点
      继续流式输出（UI 中无缝）。
    """
    body: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": _render_fallback_prompt(ctx)}],
        "stream": True,
        "max_tokens": _MAX_TOKENS,
    }
    if "siliconflow.cn" in base:
        body["enable_thinking"] = not ctx.has_draft
    else:
        body["thinking"] = {"type": "enabled" if not ctx.has_draft else "disabled"}
    return CompletionRequest(
        url=f"{base}/chat/completions",
        headers=headers,
        body=body,
    )
