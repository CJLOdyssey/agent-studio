"""模型定价表与成本计算（独立于用量追踪的单一职责模块）。

定价表遵循 PostHog 风格的生产实践：
  - 用 effective_from 日期做版本化
  - 单一事实来源（不内联费率）
  - 未知模型 fail-loud（不静默回退）
  - 可通过 MODEL_PRICING_JSON 环境变量覆盖
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class ModelPrice:
    prompt: float   # 每 1K 输入 tokens 的美元价格
    completion: float  # 每 1K 输出 tokens 的美元价格
    effective_from: str  # 该价格生效的 ISO 日期


# 每 1K tokens 的美元价格。每项：{"prompt": x, "completion": y, "effective_from": "YYYY-MM-DD"}
# 来源：各供应商官方定价页，2026-09-02 核对。
# 更新时：新增 effective_from 日期，保留旧项以保持历史准确性。
_PRICING_TABLE: dict[str, ModelPrice] = {
    # ── OpenAI ──
    "gpt-4":              ModelPrice(0.03,    0.06,    "2023-03-01"),
    "gpt-4-turbo":        ModelPrice(0.01,    0.03,    "2024-04-01"),
    "gpt-4o":             ModelPrice(0.0025,  0.01,    "2024-05-01"),
    "gpt-4o-mini":        ModelPrice(0.00015, 0.0006,  "2024-07-01"),
    "gpt-3.5-turbo":      ModelPrice(0.0005,  0.0015,  "2023-11-01"),
    # ── DeepSeek ──
    "deepseek-chat":               ModelPrice(0.00014, 0.00028, "2024-01-01"),
    "deepseek-coder":              ModelPrice(0.00014, 0.00028, "2024-01-01"),
    "deepseek-ai/DeepSeek-V4-Flash": ModelPrice(0.00014, 0.00028, "2026-07-31"),
    "deepseek-ai/DeepSeek-V4-Pro":   ModelPrice(0.000435, 0.00087, "2026-07-31"),
    # ── Anthropic ──
    "claude-sonnet-4-20250514":  ModelPrice(0.003,  0.015,  "2025-05-14"),
    "claude-haiku-35-20241022":  ModelPrice(0.0008, 0.004,  "2024-10-22"),
}


def _load_pricing_overrides() -> dict[str, ModelPrice]:
    """从 MODEL_PRICING_JSON 环境变量加载定价覆盖。

    期望格式（扁平字典，按每 1K tokens）：
    {"gpt-4o": {"prompt": 0.0025, "completion": 0.01}}
    """
    raw = os.environ.get("MODEL_PRICING_JSON", "")
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        overrides: dict[str, ModelPrice] = {}
        for model, prices in data.items():
            overrides[model] = ModelPrice(
                prompt=prices["prompt"],
                completion=prices["completion"],
                effective_from=prices.get("effective_from", "override"),
            )
        logger.info("Loaded %d pricing overrides from MODEL_PRICING_JSON", len(overrides))
        return overrides
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.warning("MODEL_PRICING_JSON is invalid (%s), using defaults", exc)
        return {}


def get_model_pricing(model: str) -> ModelPrice | None:
    """查询某模型的定价。未知时返回 None。"""
    overrides = _load_pricing_overrides()
    return overrides.get(model) or _PRICING_TABLE.get(model)


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """按给定模型与 token 用量计算美元成本。

    模型不在定价表中时抛出 ValueError。
    调用方应捕获并处理（记录日志 + 置 cost=0）以避免中断流水线。
    """
    pricing = get_model_pricing(model)
    if pricing is None:
        raise ValueError(
            f"Unknown model '{model}' — add it to _PRICING_TABLE or set MODEL_PRICING_JSON. "
            f"Known models: {', '.join(sorted(_PRICING_TABLE.keys()))}"
        )
    prompt_cost = (prompt_tokens / 1000) * pricing.prompt
    completion_cost = (completion_tokens / 1000) * pricing.completion
    return prompt_cost + completion_cost


def list_pricing() -> dict[str, dict[str, Any]]:
    """返回完整定价表（供 API 暴露）。"""
    return {
        model: {"prompt": p.prompt, "completion": p.completion, "effective_from": p.effective_from}
        for model, p in _PRICING_TABLE.items()
    }
