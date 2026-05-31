import pytest

from virtual_team.extractors import extract_all, extract_code, extract_pm_document, extract_review
from virtual_team.models import Message
from virtual_team.prompts import APPROVAL_KEYWORD


class TestExtractCode:
    def test_extract_simple_code_block(self):
        text = "```python\nprint('hello')\n```"
        assert extract_code(text) == "print('hello')"

    def test_extract_code_without_language(self):
        text = "```\nx = 1\n```"
        assert extract_code(text) == "x = 1"

    def test_multiple_code_blocks(self):
        text = "```py\na=1\n```\n...\n```js\nb=2\n```"
        result = extract_code(text)
        assert "a=1" in result
        assert "b=2" in result

    def test_no_code_block(self):
        text = "纯文本内容，没有代码块"
        assert extract_code(text) == ""

    def test_empty_text(self):
        assert extract_code("") == ""


class TestExtractAll:
    def test_extracts_from_role_agnostic_messages(self):
        messages = [
            Message(role="frontend", content="设计文档：用户登录功能", round_number=1),
            Message(role="backend", content="```python\ndef login(): pass\n```", round_number=2),
            Message(role="tester", content=f"代码通过审查{APPROVAL_KEYWORD}", round_number=3),
        ]
        result = extract_all(messages)
        assert "设计文档" in result["pm_document"]
        assert "def login" in result["code"]
        assert "代码通过审查" in result["review"]

    def test_extracts_code_from_any_role(self):
        messages = [
            Message(role="reviewer", content="设计方案说明", round_number=1),
            Message(role="frontend", content="```html\n<div>hello</div>\n```", round_number=2),
        ]
        result = extract_all(messages)
        assert "<div>hello</div>" in result["code"]
        assert "设计方案说明" in result["pm_document"]

    def test_empty_messages_raises_error(self):
        with pytest.raises(ValueError, match="must not be empty"):
            extract_all([])

    def test_first_message_is_pm_doc(self):
        messages = [
            Message(role="designer", content="产品方案", round_number=1),
            Message(role="coder", content="代码实现", round_number=2),
        ]
        result = extract_all(messages)
        assert result["pm_document"] == "产品方案"

    def test_approval_without_approver_role(self):
        messages = [
            Message(role="anyone", content=f"好的{APPROVAL_KEYWORD}", round_number=1),
        ]
        result = extract_all(messages)
        assert "好的" in result["review"]

    def test_no_approval_no_review(self):
        messages = [
            Message(role="frontend", content="设计", round_number=1),
            Message(role="backend", content="```py\nx=1\n```", round_number=2),
        ]
        result = extract_all(messages)
        assert result["review"] == ""


class TestExtractReview:
    def test_strips_approval_keyword(self):
        text = f"代码质量良好\n{APPROVAL_KEYWORD}"
        assert extract_review(text) == "代码质量良好"

    def test_keeps_content_without_keyword(self):
        text = "一般审查意见"
        assert extract_review(text) == "一般审查意见"

    def test_empty_text_raises_error(self):
        with pytest.raises(ValueError, match="must not be empty"):
            extract_review("")


class TestExtractDocument:
    def test_extracts_simple_text(self):
        assert extract_pm_document("文档内容") == "文档内容"

    def test_empty_text_raises_error(self):
        with pytest.raises(ValueError, match="must not be empty"):
            extract_pm_document("")

    def test_whitespace_only_raises_error(self):
        with pytest.raises(ValueError, match="must not be empty"):
            extract_pm_document("   ")
