"""Tests for cost/pricing.py — get_model_pricing, calculate_cost, list_pricing."""

from __future__ import annotations

from cost.pricing import get_model_pricing, calculate_cost, list_pricing, ModelPrice

import pytest


def test_get_model_pricing_known_model():
    result = get_model_pricing("gpt-4")
    assert result is not None
    assert isinstance(result, ModelPrice)
    assert result.prompt > 0


def test_get_model_pricing_unknown_model():
    result = get_model_pricing("nonexistent-model-xyz")
    assert result is None


def test_calculate_cost_known_model():
    cost = calculate_cost("gpt-4", prompt_tokens=1000, completion_tokens=500)
    assert cost > 0


def test_calculate_cost_unknown_model():
    with pytest.raises(ValueError, match="Unknown model"):
        calculate_cost("nonexistent-model-xyz", prompt_tokens=1000, completion_tokens=500)


def test_list_pricing():
    pricing = list_pricing()
    assert isinstance(pricing, dict)
    assert len(pricing) > 0
    for model, info in pricing.items():
        assert "prompt" in info
        assert "completion" in info
