"""Tests for graph/helpers.py — as_text, is_balance_error, emit_balance_warning."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from graph.helpers import as_text, is_balance_error, emit_balance_warning


def test_as_text_none():
    assert as_text(None) is None


def test_as_text_empty_string():
    assert as_text("") is None


def test_as_text_whitespace():
    assert as_text("   ") is None


def test_as_text_string():
    assert as_text("hello") == "hello"


def test_as_text_list_of_dicts():
    content = [{"type": "text", "text": "hello"}, {"type": "text", "text": "world"}]
    assert as_text(content) == "hello\nworld"


def test_as_text_list_empty():
    assert as_text([]) is None


def test_as_text_non_string():
    assert as_text(123) == "123"


def test_is_balance_error_quota():
    assert is_balance_error("insufficient_quota") is True


def test_is_balance_error_balance():
    assert is_balance_error("insufficient balance") is True


def test_is_balance_error_402():
    assert is_balance_error("402 payment required") is True


def test_is_balance_error_normal():
    assert is_balance_error("something else") is False


@pytest.mark.asyncio
async def test_emit_balance_warning_with_handler():
    mock_cb = AsyncMock()
    mock_cb.emit_balance_warning = AsyncMock()
    await emit_balance_warning(mock_cb)
    mock_cb.emit_balance_warning.assert_called_once()


@pytest.mark.asyncio
async def test_emit_balance_warning_fallback():
    mock_cb = AsyncMock(spec=[])
    await emit_balance_warning(mock_cb)
    mock_cb.assert_called_once()
