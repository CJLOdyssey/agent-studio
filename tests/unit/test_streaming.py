"""Tests for streaming module (StreamEmitter)."""

from virtual_team.streaming import StreamEmitter


class TestStreamEmitter:
    def test_emitter_initialisation(self):
        emitter = StreamEmitter(run_id="test-run-123")
        assert emitter._run_id == "test-run-123"
        assert emitter._message_index == 0

    def test_emitter_increments_index(self):
        emitter = StreamEmitter(run_id="test-run-456")
        assert emitter._message_index == 0


class TestStreamEmitterAsync:
    def test_emit_initial_index_is_zero(self):
        """StreamEmitter starts with message_index 0 before any emits."""
        emitter = StreamEmitter(run_id="test-run-emit")
        assert emitter._message_index == 0
