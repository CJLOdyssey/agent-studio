"""Tests for task infrastructure (_build_session_context, _run_async)."""

from virtual_team.tasks import _build_session_context, _run_async


class TestBuildSessionContext:
    def test_empty_memories_returns_empty_string(self):
        result = _build_session_context([])
        assert result == ""

    def test_with_memories_builds_context(self):
        memories = [
            type("Mem", (), {"content_type": "pm_document", "agent_role": "pm", "summary": "需求文档摘要"})(),
            type("Mem", (), {"content_type": "code", "agent_role": "programmer", "summary": "代码实现"})(),
        ]
        result = _build_session_context(memories)
        assert "pm_document" in result
        assert "code" in result
        assert "需求文档摘要" in result

    def test_single_memory(self):
        memories = [
            type("Mem", (), {"content_type": "review", "agent_role": "tester", "summary": "审查通过"})(),
        ]
        result = _build_session_context(memories)
        assert "review" in result
        assert "审查通过" in result


class TestRunAsync:
    async def _sample_async_fn(self, x: int) -> int:
        return x * 2

    def test_run_async_executes_coroutine(self):
        result = _run_async(self._sample_async_fn(21))
        assert result == 42
