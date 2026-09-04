"""Run 创建的辅助逻辑（从 RunService.create_run 提取）。

单一职责：会话解析与 API key 解析，供 create_run / continue_run 复用。"""

from __future__ import annotations

from core.infra.logging_config import get_logger
from repository import (
    create_session,
    get_api_key_for_model,
    get_api_key_for_use,
    get_default_api_key,
    get_session,
    update_session_team,
)

logger = get_logger(__name__)


async def resolve_session(
    *,
    session_id: str | None,
    user_id: str,
    requirement: str,
    agent_id: str | None = None,
    team_id: str | None = None,
) -> tuple[str, str | None, str | None]:
    """解析或创建会话。返回 (session_id, agent_id, team_id)。"""
    kind = "agent" if agent_id else "team" if team_id else "normal"
    if session_id is None:
        sess = await create_session(
            title=requirement[:64],
            user_id=user_id,
            agent_id=agent_id,
            kind=kind,
            team_id=team_id,
        )
        return sess.id, agent_id, team_id

    existing_sess = await get_session(session_id)
    if existing_sess is None:
        logger.warning("session_id=%s not found, creating new session", session_id)
        sess = await create_session(
            title=requirement[:64], user_id=user_id, agent_id=agent_id, kind=kind, team_id=team_id
        )
        return sess.id, agent_id, team_id

    if agent_id is None and existing_sess.agent_id:
        agent_id = existing_sess.agent_id
    if team_id is None and existing_sess.team_id:
        team_id = existing_sess.team_id
    if team_id and not existing_sess.team_id:
        await update_session_team(session_id, team_id)

    return session_id, agent_id, team_id


async def resolve_api_key(
    *,
    user_id: str,
    key_id: str | None,
    effective_model: str,
) -> tuple[str | None, str | None, bool, str | None]:
    """解析 API key。返回 (api_key, api_base, image_model, resolved_key_id)。"""
    api_key: str | None = None
    api_base: str | None = None
    image_model = False
    resolved_key_id: str | None = None

    try:
        if key_id:
            key_entry = await get_api_key_for_use(key_id, user_id)
            if key_entry:
                api_key = key_entry.get("api_key")
                api_base = key_entry.get("base_url") or api_base
                resolved_key_id = key_entry.get("id") or key_id
        if not api_key and effective_model:
            model_key = await get_api_key_for_model(effective_model, user_id)
            if model_key:
                api_key = model_key.get("api_key")
                api_base = model_key.get("base_url") or api_base
                image_model = (model_key.get("model_types") or {}).get(effective_model) == "image"
                resolved_key_id = model_key.get("id") or resolved_key_id
        if not api_key:
            default_key = await get_default_api_key(user_id)
            if default_key:
                api_key = default_key["api_key"]
                api_base = default_key["base_url"] or api_base
                resolved_key_id = default_key.get("id") or resolved_key_id
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("请先在设置中配置 API Key") from exc

    if not api_key:
        raise ValueError("请先在设置中配置 API Key")

    return api_key, api_base, image_model, resolved_key_id
