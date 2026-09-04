"""会话聚合领域逻辑——编辑链折叠与需求前置。

从 routers/sessions.py 抽出，使 HTTP 层保持精简。
"""

from typing import Any

from .text_utils import parse_json_list


def with_requirement_message(run: Any, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """当 run 没有持久化的用户消息时，将 run 需求前置为合成用户消息。

    chat_messages 只存储 assistant/agent 轮次；用户提示词保存在 run 的
    ``requirement`` 字段中。"""
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
    """折叠编辑-重新生成的 run，使每条链仅显示最新 run。

    编辑重新生成用户消息会创建一个新的 run，其 ``parent_run_id`` 指向被替换
    的 run。将共享共同根的 run 分组，仅显示最新者，把较旧答案折叠进
    ``versions``。"""
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
