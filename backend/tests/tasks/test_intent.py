"""Tests for tasks/intent.py — detect_open_url."""

from __future__ import annotations

from tasks.intent import detect_open_url


def test_detect_open_url_baidu():
    assert detect_open_url("打开百度") == "https://www.baidu.com"


def test_detect_open_url_google():
    assert detect_open_url("访问谷歌") == "https://www.google.com"


def test_detect_open_url_github():
    assert detect_open_url("打开github") == "https://github.com"


def test_detect_open_url_no_trigger():
    assert detect_open_url("今天天气怎么样") is None


def test_detect_open_url_domain():
    result = detect_open_url("打开 example.com")
    assert result is not None
    assert "example.com" in result


def test_detect_open_url_full_url():
    result = detect_open_url("访问 https://test.com")
    assert result is not None
    assert "test.com" in result


def test_detect_open_url_douyin():
    assert detect_open_url("打开抖音") == "https://www.douyin.com"


def test_detect_open_url_bing():
    assert detect_open_url("去bing") == "https://www.bing.com"
