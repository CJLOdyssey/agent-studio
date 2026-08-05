# Fix 10: service 层空心化修复（sessions 领域逻辑抽取）Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p10 main -b fix/p10-service-layer`）。只修改本文件列出的文件。**禁碰 `backend/src/services/run_service.py`（P11 独占）与 `backend/src/tasks/`。**

**Goal:** 把驻留在 `routers/sessions.py` 的领域逻辑（编辑链折叠、requirement 注入）移入 service 层，消除 `_parse_json_list` 重复。
**Architecture:** 新建 `text_utils.py`（无业务逻辑的解析工具）与 `session_service.py`（sessions 领域逻辑），`routers/sessions.py` 改薄。
**Tech Stack:** Python 3.12 / FastAPI / pytest

## 并行协调

- 独占文件：`backend/src/services/text_utils.py`（新）、`backend/src/services/session_service.py`（新）、`backend/src/routers/sessions.py`、`backend/tests/services/test_session_service.py`（新）
- **禁碰** `run_service.py`（P11 独占）；其内部重复的 `_parse_json_list` 由 P11 merge 后作为 follow-up 清理

## Global Constraints

- 单文件 ≤400 行
- 行为保持：sessions.py 对外 API 与返回结构不变
- TDD：先写测试
- 提交遵循 .gitmessage 格式

---

## 根因

`routers/sessions.py`(420 行) 混 HTTP 与领域逻辑：`_merge_edit_chains`（L70-109，编辑-重生成链折叠算法）、`_with_requirement_message`（L32-57）、`_parse_json_list`（L60-67，与 `run_service.py:50` 逐字重复）。21/21 router 直连 repository，service 层空心。

## Files

- Create: `backend/src/services/text_utils.py`
- Create: `backend/src/services/session_service.py`
- Modify: `backend/src/routers/sessions.py`
- Create: `backend/tests/services/test_session_service.py`

---

- [ ] **Step 1: 创建 `text_utils.py`**

```python
"""Shared text parsing helpers (no business logic)."""

import json
from typing import Any


def parse_json_list(raw: str | None) -> list[str] | None:
    """Parse a JSON array string into a list; None on empty/invalid."""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else None
    except Exception:
        return None


__all__ = ["parse_json_list"]
```

- [ ] **Step 2: 创建 `session_service.py`（搬运 `_with_requirement_message` / `_merge_edit_chains`）**

```python
"""Session aggregation domain logic — edit-chain folding & requirement prepend.

Extracted from routers/sessions.py so HTTP layer stays thin.
"""

from typing import Any

from .text_utils import parse_json_list


def with_requirement_message(run: Any, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Prepend the run requirement as a synthetic user message when the run has
    no persisted user message. chat_messages only stores assistant/agent turns;
    the user prompt lives on the run's ``requirement`` field."""
    if any(m.get("role") == "user" for m in messages):
        return messages
    req = (run.requirement or "").strip()
    if not req:
        return messages
    return [
        {
            "id": f"run-{run.id}-requirement",
            "role": "user",
            "agent_name": "我",
            "content": req,
            "thinking": None,
            "round_number": 0,
            "created_at": None,
            "user_versions": parse_json_list(getattr(run, "requirement_versions", None)),
        },
        *messages,
    ]


def merge_edit_chains(
    runs: list[Any], messages_by_run: dict[str, list[dict[str, Any]]]
) -> list[tuple[Any, list[dict[str, Any]]]]:
    """Fold edit-regenerate runs so only the newest run of each chain is shown.

    Edit-regenerating a user message creates a NEW run whose ``parent_run_id``
    points at the replaced run. Groups every run sharing a common root and
    displays only the newest one, folding older answers into ``versions``."""
    by_id = {r.id: r for r in runs}
    groups: dict[str, list[Any]] = {}
    for r in runs:
        root = r
        while root.parent_run_id and root.parent_run_id in by_id:
            root = by_id[root.parent_run_id]
        groups.setdefault(root.id, []).append(r)

    result: list[tuple[Any, list[dict[str, Any]]]] = []
    for group in groups.values():
        group.sort(key=lambda x: x.created_at)
        latest = group[-1]
        msgs = [dict(m) for m in messages_by_run.get(latest.id, [])]
        versions: list[str] = []
        thinking_versions: list[str] = []
        for cr in group[:-1]:
            hist = [m for m in messages_by_run.get(cr.id, []) if m.get("role") != "user"]
            if hist:
                versions.append(hist[-1].get("content", ""))
                thinking_versions.append(hist[-1].get("thinking") or "")
        if versions and msgs:
            agent_idx = next((i for i, m in enumerate(msgs) if m.get("role") != "user"), -1)
            if agent_idx >= 0:
                msgs[agent_idx]["versions"] = versions + list(msgs[agent_idx].get("versions") or [])
                msgs[agent_idx]["thinking_versions"] = (
                    thinking_versions + list(msgs[agent_idx].get("thinking_versions") or [])
                )
        result.append((latest, msgs))
    return result


__all__ = ["with_requirement_message", "merge_edit_chains"]
```

- [ ] **Step 3: 精简 routers/sessions.py**

删除 L32-109 的 `_with_requirement_message` / `_parse_json_list` / `_merge_edit_chains`，改为导入：

```python
from services.session_service import merge_edit_chains, with_requirement_message
from services.text_utils import parse_json_list
```

原调用点改名：`_with_requirement_message(` → `with_requirement_message(`，`_merge_edit_chains(` → `merge_edit_chains(`。

- [ ] **Step 4: 创建 `test_session_service.py`**

```python
"""Unit tests for session_service domain logic (edit-chain folding)."""

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from services.session_service import merge_edit_chains, with_requirement_message


def _run(run_id: str, parent: str | None = None, requirement: str = "需求") -> Any:
    return SimpleNamespace(id=run_id, parent_run_id=parent, requirement=requirement,
                           created_at=datetime.now(UTC))


def _msg(run_id: str, role: str, content: str) -> dict[str, Any]:
    return {"id": f"m-{run_id}", "role": role, "content": content, "thinking": None}


def test_fold_shows_only_latest_of_chain():
    r1 = _run("r1")
    r2 = _run("r2", parent="r1")
    result = merge_edit_chains([r1, r2], {"r1": [_msg("r1", "agent", "旧答案")],
                                          "r2": [_msg("r2", "agent", "新答案")]})
    assert len(result) == 1
    latest, msgs = result[0]
    assert latest.id == "r2"
    assert msgs[0]["versions"] == ["旧答案"]


def test_requirement_prepended_when_no_user_message():
    run = _run("r1")
    msgs = [_msg("r1", "agent", "答案")]
    out = with_requirement_message(run, msgs)
    assert out[0]["role"] == "user"
    assert out[0]["content"] == "需求"


def test_requirement_not_prepended_when_user_message_exists():
    run = _run("r1")
    msgs = [_msg("r1", "user", "用户原话"), _msg("r1", "agent", "答案")]
    out = with_requirement_message(run, msgs)
    assert out == msgs
```

- [ ] **Step 5: 验证**

```bash
pytest backend/tests/services/test_session_service.py -v  # 3 个新测试 PASS
pytest backend/tests/routers/test_routers_sessions.py -v  # 既有测试全绿
ruff check backend/src/routers/sessions.py backend/src/services/  # 无告警
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/text_utils.py backend/src/services/session_service.py \
        backend/src/routers/sessions.py backend/tests/services/test_session_service.py
git commit -m "refactor(backend): extract session domain logic into services layer"
```

## Self-Review

- `parse_json_list` 现为 `text_utils` 单一实现；`run_service.py` 内重复副本由 P11 merge 后 follow-up 清理（本方案不碰）
- sessions.py 对外响应结构不变，既有 router 测试应全绿
- 新 service 文件均 <100 行，符合 ≤400 约束
