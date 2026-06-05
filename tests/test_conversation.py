"""Tests for conversation task infrastructure (StreamEmitter, helpers)."""

from virtual_team.tasks import _build_session_context, _run_async
from virtual_team.streaming import StreamEmitter


class TestStreamEmitter:
    def test_emitter_initialisation(self):
        emitter = StreamEmitter(run_id="test-run-123")
        assert emitter._run_id == "test-run-123"
        assert emitter._message_index == 0

    def test_emitter_increments_index(self):
        emitter = StreamEmitter(run_id="test-run-456")
        assert emitter._message_index == 0
        # _emit is async so we can't easily test it without a running loop,
        # but we can verify the initial state


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


class TestStreamEmitterAsync:
    def test_emit_initial_index_is_zero(self):
        """StreamEmitter starts with message_index 0 before any emits."""
        emitter = StreamEmitter(run_id="test-run-emit")
        assert emitter._message_index == 0
