"""resolve_usage_order 单测：排序白名单 fail-fast（防 order_by 注入面）。"""

import pytest

from cost.token_tracker import resolve_usage_order


class TestResolveUsageOrder:
    def test_valid_pairs(self):
        for col in ("timestamp", "prompt_tokens", "completion_tokens", "cost_usd"):
            column, asc = resolve_usage_order(col, "asc")
            assert column.key == col and asc is True
            column, asc = resolve_usage_order(col, "desc")
            assert column.key == col and asc is False

    def test_invalid_column_raises(self):
        with pytest.raises(ValueError, match="order_by"):
            resolve_usage_order("(SELECT 1)", "asc")  # 注入面样本

    def test_invalid_dir_raises(self):
        with pytest.raises(ValueError, match="order_dir"):
            resolve_usage_order("timestamp", "ASC")  # 大小写敏感，不给隐式默认

    def test_no_silent_fallback(self):
        """非法值必须抛错而非静默回落 timestamp（项目红线：不给隐式默认）。"""
        with pytest.raises(ValueError):
            resolve_usage_order("total_tokens", "desc")
