"""
Checkpoint persistence recovery tests.

Validates that LangGraph checkpoints survive process restarts,
cross-process access, error rollback, and optional PostgreSQL backend.

Usage:
    PYTHONPATH=. python3 -m pytest virtual_team/tests/test_checkpoint_persistence.py -v
"""

import os
import subprocess
import sys
import textwrap
from pathlib import Path
from uuid import uuid4

import pytest

# Ensure virtual_team is importable
_sys_insert = str(Path(__file__).resolve().parent.parent.parent)
if _sys_insert not in sys.path:
    sys.path.insert(0, _sys_insert)


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────


def _make_config(thread_id: str, checkpoint_ns: str = "") -> dict:
    """Build a RunnableConfig-compatible dict for checkpoint operations."""
    return {"configurable": {"thread_id": thread_id, "checkpoint_ns": checkpoint_ns}}


def _make_checkpoint(**channel_values) -> dict:
    """Build a minimal Checkpoint dict with required fields."""
    return {
        "v": 1,
        "id": str(uuid4()),
        "ts": "2024-01-01T00:00:00Z",
        "channel_values": channel_values,
        "channel_versions": {},
        "versions_seen": {},
    }


def _make_metadata(source: str = "loop", step: int = 0) -> dict:
    """Build a minimal CheckpointMetadata dict."""
    return {"source": source, "step": step, "parents": {}}


# ─────────────────────────────────────────────────────────────────────
# Local fixtures — scoped to this test module only
# ─────────────────────────────────────────────────────────────────────


@pytest.fixture
def checkpointer_sqlite(tmp_path):
    """Create a SqliteSaver backed by a temp file. Cleans up after test."""
    from virtual_team.checkpoint import create_checkpointer

    db_path = str(tmp_path / "checkpoints.db")
    os.environ["CHECKPOINTER_BACKEND"] = "sqlite"
    os.environ["CHECKPOINTER_DSN"] = db_path

    cp = create_checkpointer()
    yield cp

    # Cleanup: close connection and remove file
    try:
        conn = getattr(cp, "conn", None)
        if conn is not None:
            conn.close()
    except Exception:
        pass
    if os.path.exists(db_path):
        os.unlink(db_path)


@pytest.fixture
def checkpointer_sqlite_fresh(checkpointer_sqlite):
    """Same as checkpointer_sqlite but for tests needing a second instance
    against the *same* DB file — depends on checkpointer_sqlite to ensure
    CHECKPOINTER_DSN env vars are already set."""
    from virtual_team.checkpoint import create_checkpointer

    return create_checkpointer()


# ─────────────────────────────────────────────────────────────────────
# Test 1: Cross-process persistence with SQLite
# ─────────────────────────────────────────────────────────────────────


def test_sqlite_persistence_cross_process(checkpointer_sqlite, checkpointer_sqlite_fresh):
    """Process A writes a checkpoint, Process B reads it back from the same DB file.

    This simulates what happens when a server restarts — a new process
    opens the same checkpoint DB and must recover prior state.
    """
    config = _make_config("test-t1")
    checkpoint = _make_checkpoint(msg="hello", agent_state="initial")
    metadata = _make_metadata(source="input", step=0)

    # Process A: write
    checkpointer_sqlite.put(config, checkpoint, metadata, {})

    # Process B (fresh instance, same DB file): read back
    result = checkpointer_sqlite_fresh.get(config)
    assert result is not None, "Checkpoint should survive across checkpointer instances"
    assert result["channel_values"]["msg"] == "hello"
    assert result["channel_values"]["agent_state"] == "initial"


# ─────────────────────────────────────────────────────────────────────
# Test 2: Recovery after simulated restart via subprocess
# ─────────────────────────────────────────────────────────────────────


def test_recovery_after_restart(tmp_path):
    """Simulate a hard process exit after writing state, then verify recovery.

    A subprocess writes checkpoint state and calls os._exit(0) to simulate
    an abrupt shutdown. The main process then opens the same DB file and
    confirms the state was durably persisted.
    """
    db_path = str(tmp_path / "recovery.db")

    writer_script = textwrap.dedent(f"""
    import os
    import sys
    sys.path.insert(0, {str(Path(__file__).resolve().parent.parent.parent)!r})

    os.environ["CHECKPOINTER_BACKEND"] = "sqlite"
    os.environ["CHECKPOINTER_DSN"] = {db_path!r}

    from virtual_team.checkpoint import create_checkpointer

    cp = create_checkpointer()
    config = {{"configurable": {{"thread_id": "recovery-t1", "checkpoint_ns": ""}}}}
    checkpoint = {{
        "v": 1,
        "id": "ckpt-recovery-1",
        "ts": "2024-06-25T12:00:00Z",
        "channel_values": {{"recovered": True, "step_count": 5}},
        "channel_versions": {{}},
        "versions_seen": {{}},
    }}
    metadata = {{"source": "loop", "step": 5, "parents": {{}}}}
    cp.put(config, checkpoint, metadata, {{}})
    cp.conn.close()
    os._exit(0)
    """)

    script_path = tmp_path / "_writer.py"
    script_path.write_text(writer_script)

    result = subprocess.run(
        [sys.executable, str(script_path)],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, (
        f"Writer subprocess failed (rc={result.returncode}):\n"
        f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    )

    # Now recover from the same DB file in this process
    os.environ["CHECKPOINTER_BACKEND"] = "sqlite"
    os.environ["CHECKPOINTER_DSN"] = db_path

    from virtual_team.checkpoint import create_checkpointer

    recovery_cp = create_checkpointer()
    config = _make_config("recovery-t1")
    recovered = recovery_cp.get(config)  # type: ignore[arg-type]

    assert recovered is not None, "State should be recoverable after subprocess _exit(0)"
    assert recovered["channel_values"]["recovered"] is True
    assert recovered["channel_values"]["step_count"] == 5

    # Cleanup
    try:
        conn = getattr(recovery_cp, "conn", None)
        if conn is not None:
            conn.close()
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────
# Test 3: PostgreSQL backend — optional import check
# ─────────────────────────────────────────────────────────────────────


def test_postgres_backend_optional():
    """Verify the PostgresSaver import route compiles without crash.

    This test does NOT require a running PostgreSQL instance — it only
    validates the import path.  If the langgraph-postgres extra is not
    installed the test is skipped.
    """
    postgres_saver = pytest.importorskip(
        "langgraph.checkpoint.postgres",
        reason="langgraph-checkpoint-postgres extra not installed",
    )
    postgres_saver_cls = getattr(postgres_saver, "PostgresSaver", None)
    assert postgres_saver_cls is not None, "PostgresSaver class should be importable"

    # Verify the from_conn_string classmethod exists (used by create_checkpointer)
    assert hasattr(postgres_saver_cls, "from_conn_string"), (
        "PostgresSaver must expose from_conn_string classmethod"
    )


# ─────────────────────────────────────────────────────────────────────
# Test 4: Error rollback — checkpoint survives mid-step failure
# ─────────────────────────────────────────────────────────────────────


def test_checkpointer_rollback_on_error(checkpointer_sqlite, checkpointer_sqlite_fresh):
    """Verify that a checkpoint written before an error remains retrievable.

    Scenario: the agent writes state at step 3, encounters a tool error
    during the ReAct loop at step 4, and the system must recover from
    the last known good state (step 3).
    """
    thread_id = "rollback-t1"
    config = _make_config(thread_id)

    # Write step 3 state — the "before error" snapshot
    before_error = _make_checkpoint(
        messages=["assistant: calling tool"],
        step=3,
        tool_calls_pending=True,
    )
    checkpointer_sqlite.put(config, before_error, _make_metadata(step=3), {})

    # Simulate: tool error occurs at step 4, but system does NOT persist
    # the intermediate error state.  In a real agent, the framework would
    # only call put() after successful tool execution.
    error_occurred = True
    if error_occurred:
        # The error checkpoint is intentionally NOT persisted — the
        # framework should fall back to the last good checkpoint.

        # Verify the pre-error state is still the latest persisted state
        recovered = checkpointer_sqlite_fresh.get(config)
        assert recovered is not None, "Pre-error checkpoint must be retrievable"
        assert recovered["channel_values"]["step"] == 3
        assert recovered["channel_values"]["tool_calls_pending"] is True
        assert "error" not in recovered["channel_values"], (
            "Error state was never persisted — it must not appear in recovered data"
        )

    # Write a post-recovery step (step 5) to confirm forward progress
    after_recovery = _make_checkpoint(
        messages=["assistant: tool succeeded, continuing"],
        step=5,
        tool_calls_pending=False,
        recovered_from_error=True,
    )
    saved = checkpointer_sqlite.put(config, after_recovery, _make_metadata(step=5), {})

    # Use the returned config (with checkpoint_id) for deterministic reads.
    # SqliteSaver orders by checkpoint_id (UUID string), which can be
    # non-deterministic — passing checkpoint_id avoids ordering issues.
    latest = checkpointer_sqlite_fresh.get(saved)
    assert latest is not None
    assert latest["channel_values"]["step"] == 5
    assert latest["channel_values"]["recovered_from_error"] is True
