import asyncio
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import desc, select, update as sa_update
from sqlalchemy.orm import selectinload

from virtual_team.database import (
    AgentConfigDB,
    ChatMessage,
    MemoryEntry,
    ProjectRun,
    SessionDB,
    get_session_factory,
)
from virtual_team.models import AgentConfig
from virtual_team.prompts import DIRECT_REPLY_KEYWORD


# ---- Session CRUD ----

async def create_session(title: str = "新对话") -> SessionDB:
    factory = get_session_factory()
    async with factory() as session:
        obj = SessionDB(
            id=str(uuid4()),
            title=title,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def get_session(session_id: str) -> SessionDB | None:
    factory = get_session_factory()
    async with factory() as session:
        return await session.get(SessionDB, session_id)


async def get_sessions(limit: int = 50) -> list[SessionDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(SessionDB).order_by(desc(SessionDB.updated_at)).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def update_session_title(session_id: str, title: str) -> SessionDB | None:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return None
        obj.title = title
        obj.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(obj)
        return obj


async def delete_session(session_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(SessionDB, session_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True


async def get_session_runs(session_id: str) -> list[ProjectRun]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ProjectRun)
            .where(ProjectRun.session_id == session_id)
            .order_by(ProjectRun.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_runs_by_session_ids(session_ids: list[str]) -> dict[str, list[ProjectRun]]:
    """Batch-load runs for multiple session IDs, keyed by session_id."""
    if not session_ids:
        return {}
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ProjectRun)
            .where(ProjectRun.session_id.in_(session_ids))
            .order_by(ProjectRun.created_at)
        )
        result = await session.execute(stmt)
        runs = list(result.scalars().all())
        grouped: dict[str, list[ProjectRun]] = {}
        for run in runs:
            grouped.setdefault(run.session_id or "", []).append(run)
        return grouped


# ---- Memory CRUD ----

async def get_session_memories(session_id: str) -> list[MemoryEntry]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(MemoryEntry)
            .where(MemoryEntry.session_id == session_id)
            .order_by(MemoryEntry.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def create_memory_entry(
    session_id: str,
    run_id: str,
    agent_role: str,
    content_type: str,
    summary: str,
    details: str = "",
) -> MemoryEntry:
    factory = get_session_factory()
    async with factory() as session:
        obj = MemoryEntry(
            id=str(uuid4()),
            session_id=session_id,
            run_id=run_id,
            agent_role=agent_role,
            content_type=content_type,
            summary=summary,
            details=details,
            created_at=datetime.now(UTC),
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def clear_session_memories(session_id: str):
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(MemoryEntry).where(MemoryEntry.session_id == session_id)
        result = await session.execute(stmt)
        for obj in result.scalars().all():
            await session.delete(obj)
        await session.commit()


async def delete_memory_entry(memory_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        obj = await session.get(MemoryEntry, memory_id)
        if not obj:
            return False
        await session.delete(obj)
        await session.commit()
        return True


# ---- Run CRUD ----

async def create_run(requirement: str, session_id: str | None = None) -> str:
    run_id = str(uuid4())
    run = ProjectRun(
        id=run_id,
        session_id=session_id,
        requirement=requirement,
        status="pending",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(run)
        await session.commit()
        if session_id:
            sess = await session.get(SessionDB, session_id)
            if sess:
                sess.updated_at = datetime.now(UTC)
                await session.commit()
    return run_id


async def update_run_status(run_id: str, status: str):
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        if run:
            run.status = status
            run.updated_at = datetime.now(UTC)
            await session.commit()


async def save_message(run_id: str, role: str, agent_name: str, content: str, round_number: int):
    msg = ChatMessage(
        id=str(uuid4()),
        run_id=run_id,
        role=role,
        agent_name=agent_name,
        content=content,
        round_number=round_number,
        created_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(msg)
        await session.commit()


async def update_run_result(
    run_id: str,
    pm_document: str,
    code: str,
    review: str,
    approved: bool,
    status: str,
):
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        if run:
            run.pm_document = pm_document
            run.code = code
            run.review = review
            run.approved = approved
            run.status = status
            run.updated_at = datetime.now(UTC)
            await session.commit()


async def get_run(run_id: str) -> ProjectRun | None:
    factory = get_session_factory()
    async with factory() as session:
        run = await session.get(ProjectRun, run_id)
        return run


async def get_runs(limit: int = 20) -> list[ProjectRun]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(ProjectRun).order_by(desc(ProjectRun.created_at)).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_messages(run_id: str) -> list[ChatMessage]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.run_id == run_id)
            .order_by(ChatMessage.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


# ---- Agent Config CRUD ----

async def get_agent_configs() -> list[AgentConfigDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).order_by(AgentConfigDB.order, AgentConfigDB.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_active_agent_configs() -> list[AgentConfigDB]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(AgentConfigDB)
            .where(AgentConfigDB.is_active)
            .order_by(AgentConfigDB.order, AgentConfigDB.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_agent_config_by_role(role_identifier: str) -> AgentConfigDB | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.role_identifier == role_identifier)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_agent_config(agent_id: str) -> AgentConfigDB | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(AgentConfigDB).where(AgentConfigDB.id == agent_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_run_messages(run_id: str) -> list[ChatMessage]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.run_id == run_id)
            .order_by(ChatMessage.created_at)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def create_agent_config(
    name: str,
    role_identifier: str,
    system_prompt: str,
    order: int = 0,
    is_active: bool = True,
    is_approver: bool = False,
    icon: str = "🤖",
    model: str | None = None,
    temperature: float | None = None,
) -> AgentConfigDB:
    config = AgentConfigDB(
        id=str(uuid4()),
        name=name,
        role_identifier=role_identifier,
        system_prompt=system_prompt,
        model=model,
        temperature=temperature,
        order=order,
        is_active=is_active,
        is_approver=is_approver,
        icon=icon,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    factory = get_session_factory()
    async with factory() as session:
        session.add(config)
        await session.commit()
        await session.refresh(config)
    return config


async def update_agent_config(
    id: str,
    name: str | None = None,
    system_prompt: str | None = None,
    order: int | None = None,
    is_active: bool | None = None,
    is_approver: bool | None = None,
    icon: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> AgentConfigDB | None:
    factory = get_session_factory()
    async with factory() as session:
        config = await session.get(AgentConfigDB, id)
        if not config:
            return None
        if name is not None:
            config.name = name
        if system_prompt is not None:
            config.system_prompt = system_prompt
        if order is not None:
            config.order = order
        if is_active is not None:
            config.is_active = is_active
        if is_approver is not None:
            config.is_approver = is_approver
        if icon is not None:
            config.icon = icon
        if model is not None:
            config.model = model
        if temperature is not None:
            config.temperature = temperature
        config.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(config)
    return config


async def delete_agent_config(id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        config = await session.get(AgentConfigDB, id)
        if not config:
            return False
        await session.delete(config)
        await session.commit()
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# Enterprise API Key Vault CRUD
# ═══════════════════════════════════════════════════════════════════════════════

from virtual_team.database import KeyUsageLog, UserApiKey, TeamDB, TeamAgentDB
from virtual_team.key_vault import decrypt_api_key, encrypt_api_key, mask_api_key


async def create_api_key(
    user_id: str,
    provider: str,
    label: str,
    plaintext_key: str,
    base_url: str | None = None,
    models: list[str] | None = None,
    is_default: bool = False,
) -> UserApiKey:
    """Save a new API key — encrypts before storage, returns masked record."""
    factory = get_session_factory()
    async with factory() as session:
        # If set as default, clear other defaults for this user
        if is_default:
            result = await session.execute(
                select(UserApiKey).where(
                    UserApiKey.user_id == user_id,
                    UserApiKey.is_default,
                )
            )
            for row in result.scalars().all():
                row.is_default = False

        encrypted = encrypt_api_key(plaintext_key)
        obj = UserApiKey(
            id=str(uuid4()),
            user_id=user_id,
            provider=provider,
            label=label,
            encrypted_key=encrypted,
            base_url=base_url,
            models=",".join(models) if models else "",
            is_active=True,
            is_default=is_default,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj


async def get_api_keys(user_id: str) -> list[dict]:
    """List a user's API keys — keys are MASKED, never returned in plaintext."""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(UserApiKey)
            .where(UserApiKey.user_id == user_id)
            .order_by(UserApiKey.created_at)
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "provider": r.provider,
                "label": r.label,
                "key_masked": mask_api_key(decrypt_api_key(r.encrypted_key)),
                "base_url": r.base_url,
                "models": [m.strip() for m in r.models.split(",") if m.strip()] if r.models else [],
                "is_active": r.is_active,
                "is_default": r.is_default,
                "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


async def get_api_key_for_use(key_id: str, user_id: str) -> dict | None:
    """Retrieve and decrypt an API key for LLM invocation.

    Returns full config dict with decrypted key. Updates last_used_at.
    This is the ONLY function that returns a decrypted key — it is
    never called from API routes, only from Celery tasks.
    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(UserApiKey).where(
            UserApiKey.id == key_id,
            UserApiKey.user_id == user_id,
            UserApiKey.is_active,
        )
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            return None

        row.last_used_at = datetime.now(UTC)
        await session.commit()

        return {
            "id": row.id,
            "provider": row.provider,
            "api_key": decrypt_api_key(row.encrypted_key),
            "base_url": row.base_url,
            "models": [m.strip() for m in row.models.split(",") if m.strip()] if row.models else [],
        }


async def get_default_api_key(user_id: str) -> dict | None:
    """Get the user's default active API key for LLM calls."""
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(UserApiKey).where(
            UserApiKey.user_id == user_id,
            UserApiKey.is_active,
            UserApiKey.is_default,
        )
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            # No default set — use the first active key
            stmt = select(UserApiKey).where(
                UserApiKey.user_id == user_id,
                UserApiKey.is_active,
            ).order_by(UserApiKey.created_at).limit(1)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()

        if not row:
            return None

        row.last_used_at = datetime.now(UTC)
        await session.commit()

        return {
            "id": row.id,
            "provider": row.provider,
            "api_key": decrypt_api_key(row.encrypted_key),
            "base_url": row.base_url,
            "models": [m.strip() for m in row.models.split(",") if m.strip()] if row.models else [],
        }


async def update_api_key(
    key_id: str,
    user_id: str,
    label: str | None = None,
    plaintext_key: str | None = None,
    base_url: str | None = None,
    models: list[str] | None = None,
    is_active: bool | None = None,
    is_default: bool | None = None,
) -> dict | None:
    """Update an API key configuration."""
    factory = get_session_factory()
    async with factory() as session:
        row = await session.get(UserApiKey, key_id)
        if not row or row.user_id != user_id:
            return None

        if label is not None:
            row.label = label
        if plaintext_key is not None:
            row.encrypted_key = encrypt_api_key(plaintext_key)
        if base_url is not None:
            row.base_url = base_url
        if models is not None:
            row.models = ",".join(models)
        if is_active is not None:
            row.is_active = is_active
        if is_default is not None:
            row.is_default = is_default
            if is_default:
                # Clear other defaults
                result = await session.execute(
                    select(UserApiKey).where(
                        UserApiKey.user_id == user_id,
                        UserApiKey.is_default,
                        UserApiKey.id != key_id,
                    )
                )
                for other in result.scalars().all():
                    other.is_default = False

        row.updated_at = datetime.now(UTC)
        await session.commit()

        return {
            "id": row.id,
            "label": row.label,
            "provider": row.provider,
            "key_masked": mask_api_key(decrypt_api_key(row.encrypted_key)),
            "is_active": row.is_active,
            "is_default": row.is_default,
        }


async def delete_api_key(key_id: str, user_id: str) -> bool:
    """Delete an API key. Returns True if deleted, False if not found."""
    factory = get_session_factory()
    async with factory() as session:
        row = await session.get(UserApiKey, key_id)
        if not row or row.user_id != user_id:
            return False
        await session.delete(row)
        await session.commit()
        return True


async def test_api_key_connection(key_id: str, user_id: str) -> dict:
    """Test connectivity for a stored key. Does NOT return the decrypted key.

    Runs the blocking HTTP call in a thread pool to avoid blocking the event loop.
    """
    key_cfg = await get_api_key_for_use(key_id, user_id)
    if not key_cfg:
        return {"success": False, "message": "Key not found or inactive"}

    return await asyncio.to_thread(_test_connection_sync, key_cfg)


def _test_connection_sync(key_cfg: dict) -> dict:
    """Synchronous HTTP connectivity test — runs in thread pool."""
    import urllib.request

    try:
        test_url = key_cfg.get("base_url", "").rstrip("/") + "/models"
        if not key_cfg.get("base_url"):
            # Default test endpoints per provider
            endpoints = {
                "openai": "https://api.openai.com/v1/models",
                "deepseek": "https://api.deepseek.com/v1/models",
                "anthropic": "https://api.anthropic.com/v1/models",
            }
            test_url = endpoints.get(key_cfg["provider"], "")

        if not test_url:
            return {"success": False, "message": "No base URL configured"}

        req = urllib.request.Request(test_url, method="GET")
        req.add_header("Authorization", f"Bearer {key_cfg['api_key']}")
        req.add_header("Content-Type", "application/json")

        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                return {"success": True, "message": "Connection successful"}
            return {"success": False, "message": f"HTTP {resp.status}"}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def log_key_usage(
    key_id: str | None,
    user_id: str,
    run_id: str | None,
    provider: str,
    model: str,
    tokens_prompt: int = 0,
    tokens_completion: int = 0,
    duration_ms: int = 0,
    status: str = "success",
    error_message: str | None = None,
):
    """Record an LLM call in the audit log."""
    total = tokens_prompt + tokens_completion
    factory = get_session_factory()
    async with factory() as session:
        log = KeyUsageLog(
            id=str(uuid4()),
            key_id=key_id,
            user_id=user_id,
            run_id=run_id,
            provider=provider,
            model=model,
            tokens_prompt=tokens_prompt,
            tokens_completion=tokens_completion,
            tokens_total=total,
            duration_ms=duration_ms,
            status=status,
            error_message=error_message,
        )
        session.add(log)
        await session.commit()


async def get_key_usage_stats(user_id: str) -> dict:
    """Get usage statistics for a user's keys."""
    factory = get_session_factory()
    async with factory() as session:
        from sqlalchemy import func

        # Today's stats
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt_today = (
            select(
                func.count(KeyUsageLog.id).label("requests"),
                func.sum(KeyUsageLog.tokens_total).label("tokens"),
            )
            .where(
                KeyUsageLog.user_id == user_id,
                KeyUsageLog.created_at >= today_start,
                KeyUsageLog.status == "success",
            )
        )
        result_today = await session.execute(stmt_today)
        today = result_today.one()

        # Month start
        month_start = today_start.replace(day=1)
        stmt_month = (
            select(
                func.count(KeyUsageLog.id).label("requests"),
                func.sum(KeyUsageLog.tokens_total).label("tokens"),
            )
            .where(
                KeyUsageLog.user_id == user_id,
                KeyUsageLog.created_at >= month_start,
                KeyUsageLog.status == "success",
            )
        )
        result_month = await session.execute(stmt_month)
        month = result_month.one()

        return {
            "today_requests": today.requests or 0,
            "today_tokens": today.tokens or 0,
            "month_requests": month.requests or 0,
            "month_tokens": month.tokens or 0,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Team CRUD
# ═══════════════════════════════════════════════════════════════════════════════


async def get_teams() -> list[dict]:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(TeamDB).order_by(TeamDB.order).options(
            selectinload(TeamDB.members),
        )
        result = await session.execute(stmt)
        teams = result.scalars().all()
        return [
            {
                "id": t.id,
                "name": t.name,
                "order": t.order,
                "is_expanded": t.is_expanded,
                "agents": [
                    {
                        "id": m.id,
                        "name": m.name,
                        "role": m.role,
                        "order": m.order,
                    }
                    for m in t.members
                ],
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in teams
        ]


async def get_team(team_id: str) -> dict | None:
    factory = get_session_factory()
    async with factory() as session:
        stmt = select(TeamDB).where(TeamDB.id == team_id).options(
            selectinload(TeamDB.members),
        )
        result = await session.execute(stmt)
        t = result.scalar_one_or_none()
        if not t:
            return None
        return {
            "id": t.id,
            "name": t.name,
            "order": t.order,
            "is_expanded": t.is_expanded,
            "agents": [
                {"id": m.id, "name": m.name, "role": m.role, "order": m.order}
                for m in t.members
            ],
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }


async def create_team(name: str) -> TeamDB:
    factory = get_session_factory()
    async with factory() as session:
        count = await session.execute(select(TeamDB).order_by(TeamDB.order.desc()).limit(1))
        last = count.scalar_one_or_none()
        team = TeamDB(
            id=str(uuid4()),
            name=name,
            order=(last.order + 1) if last else 0,
        )
        session.add(team)
        await session.commit()
        await session.refresh(team)
        return team


async def update_team(team_id: str, name: str | None = None, order: int | None = None, is_expanded: bool | None = None) -> TeamDB | None:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamDB).where(TeamDB.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            return None
        if name is not None:
            team.name = name
        if order is not None:
            team.order = order
        if is_expanded is not None:
            team.is_expanded = is_expanded
        await session.commit()
        await session.refresh(team)
        return team


async def delete_team(team_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(select(TeamDB).where(TeamDB.id == team_id))
        team = result.scalar_one_or_none()
        if not team:
            return False
        await session.delete(team)
        await session.commit()
        return True


async def add_team_member(team_id: str, name: str, role: str = "待配置角色") -> dict | None:
    factory = get_session_factory()
    async with factory() as session:
        team = await session.get(TeamDB, team_id)
        if not team:
            return None
        count = await session.execute(
            select(TeamAgentDB).where(TeamAgentDB.team_id == team_id).order_by(TeamAgentDB.order.desc()).limit(1)
        )
        last = count.scalar_one_or_none()
        member = TeamAgentDB(
            id=str(uuid4()),
            team_id=team_id,
            name=name,
            role=role,
            order=(last.order + 1) if last else 0,
        )
        session.add(member)
        await session.commit()
        await session.refresh(member)
        return {"id": member.id, "name": member.name, "role": member.role, "order": member.order}


async def remove_team_member(team_id: str, member_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(TeamAgentDB).where(TeamAgentDB.id == member_id, TeamAgentDB.team_id == team_id)
        )
        member = result.scalar_one_or_none()
        if not member:
            return False
        await session.delete(member)
        await session.commit()
        return True


async def reorder_team_members(team_id: str, member_ids: list[str]) -> None:
    factory = get_session_factory()
    async with factory() as session:
        for idx, mid in enumerate(member_ids):
            await session.execute(
                sa_update(TeamAgentDB)
                .where(TeamAgentDB.id == mid, TeamAgentDB.team_id == team_id)
                .values(order=idx)
            )
        await session.commit()
