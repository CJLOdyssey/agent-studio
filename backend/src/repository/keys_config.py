"""API 密钥的模型配置解析与用量统计。

从 keys_crud 拆分的独立职责：解析 embedding/rerank/tool 模型端点，
以及记录并统计密钥调用量。
"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select

from core.infra.database import get_session_factory
from core.infra.key_vault import decrypt_api_key
from orm import KeyUsageLog, UserApiKey
from rag.rag_embedding import EMBEDDING_MODEL


async def get_embedding_api_key() -> str | None:
    """获取用于嵌入的解密 API 密钥（任一具备 embedding 能力的激活密钥）。"""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(UserApiKey)
            .where(
                UserApiKey.is_active.is_(True),
                _capabilities_contains(session, "embedding"),
            )
            .order_by(UserApiKey.created_at)
            .limit(1)
        )
        row = (await session.execute(stmt)).scalar_one_or_none()
        if row is None:
            return None
        return decrypt_api_key(row.encrypted_key)


def _pick_embedding_model(models: str) -> str | None:
    """从密钥的逗号分隔 models 列表中选择一个具备 embedding 能力的模型。

    bge-m3 优先（确定性的 1024 维输出），无论列表顺序如何，优先于其他
    命名含 embedding 的模型。
    """
    if not models:
        return None
    candidates = [x.strip() for x in models.split(",")]
    for m in candidates:
        if "bge-m3" in m.lower():
            return m
    for m in candidates:
        lowered = m.lower()
        if "embedding" in lowered or "bge-" in lowered:
            return m
    return None


async def get_embedding_config() -> dict[str, str | None] | None:
    """解析嵌入端点：{api_key, base_url, model}。

    优先 models 列表命名了嵌入模型（如 bge-m3 / *-embedding-*）的激活密钥；
    回退到最旧的具备 embedding 能力的密钥，使用旧版 DashScope 端点。
    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(UserApiKey)
            .where(
                UserApiKey.is_active.is_(True),
                _capabilities_contains(session, "embedding"),
            )
            .order_by(UserApiKey.created_at)
        )
        rows = (await session.execute(stmt)).scalars().all()

    if not rows:
        return None
    for row in rows:
        model = _pick_embedding_model(row.models)
        if model:
            return {
                "api_key": decrypt_api_key(row.encrypted_key),
                "base_url": row.base_url,
                "model": model,
            }
    row = rows[0]
    return {
        "api_key": decrypt_api_key(row.encrypted_key),
        # 保留密钥自身的端点：未声明嵌入模型的密钥可能仍指向
        # OpenAI 兼容服务商（如 SiliconFlow）。只有完全没有 base_url 的密钥
        # 才回退到旧版 DashScope 原生协议。模型来自 EMBEDDING_MODEL
        # （可用环境变量调整），绝不硬编码。
        "base_url": row.base_url,
        "model": EMBEDDING_MODEL,
    }


def _pick_rerank_model(models: str) -> str | None:
    """从密钥的逗号分隔 models 列表中选择 reranker 模型。

    bge-reranker-v2-m3 优先于其他命名含 rerank 的模型。
    """
    if not models:
        return None
    candidates = [x.strip() for x in models.split(",")]
    for m in candidates:
        if "bge-reranker-v2-m3" in m.lower():
            return m
    for m in candidates:
        if "rerank" in m.lower():
            return m
    return None


async def get_rerank_config() -> dict[str, str] | None:
    """解析 reranker 端点：{api_key, base_url, model}。

    优先 models 列表命名了 reranker 的激活密钥；无密钥声明时返回 None
    （rerank 保持禁用）。
    """
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(UserApiKey)
            .where(UserApiKey.is_active.is_(True))
            .order_by(UserApiKey.created_at)
        )
        rows = (await session.execute(stmt)).scalars().all()

    for row in rows:
        model = _pick_rerank_model(row.models)
        if model and row.base_url:
            return {
                "api_key": decrypt_api_key(row.encrypted_key),
                "base_url": row.base_url,
                "model": model,
            }
    return None


async def get_tool_api_key(provider: str) -> str | None:
    """获取工具服务商（如 'tavily'）的解密 API 密钥。"""
    factory = get_session_factory()
    async with factory() as session:
        stmt = (
            select(UserApiKey)
            .where(
                UserApiKey.provider == provider,
                UserApiKey.is_active.is_(True),
                _capabilities_contains(session, "tool"),
            )
            .order_by(UserApiKey.created_at)
            .limit(1)
        )
        row = (await session.execute(stmt)).scalar_one_or_none()
        if row is None:
            return None
        return decrypt_api_key(row.encrypted_key)


def _capabilities_contains(session: Any, capability: str) -> Any:
    """数组包含谓词：postgres 用 JSONB ``@>``，sqlite 用 ``json_each``。

    ``UserApiKey.capabilities`` 在 postgres 上是 JSONB（``contains`` 编译为
    ``@>`` 运算符），但在 sqlite（``with_variant``）上是普通 JSON，那里
    ``@>`` 运算符不存在——用 json1 ``json_each`` 表函数模拟「数组包含值」，
    使过滤在两个引擎上都下推到 SQL 侧。
    """
    from sqlalchemy import exists, func

    if session.get_bind().dialect.name == "postgresql":
        return UserApiKey.capabilities.contains([capability])
    elements = func.json_each(UserApiKey.capabilities).table_valued("value")
    return exists(select(elements.c.value).where(elements.c.value == capability))


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
) -> Any:
    """在审计日志中记录一次 LLM 调用。"""
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


async def get_key_usage_stats(user_id: str | None = None) -> dict[str, Any]:
    """获取 API 密钥使用统计。

    若 user_id 为 None 或 'anonymous'，返回所有用户的统计。
    """
    factory = get_session_factory()
    async with factory() as session:
        from sqlalchemy import func

        # 今日统计
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt_today = select(
            func.count(KeyUsageLog.id).label("requests"),
            func.sum(KeyUsageLog.tokens_total).label("tokens"),
        ).where(
            KeyUsageLog.created_at >= today_start,
            KeyUsageLog.status == "success",
        )
        if user_id and user_id != 'anonymous':
            stmt_today = stmt_today.where(KeyUsageLog.user_id == user_id)
        result_today = await session.execute(stmt_today)
        today = result_today.one()

        # 本月统计
        month_start = today_start.replace(day=1)
        stmt_month = select(
            func.count(KeyUsageLog.id).label("requests"),
            func.sum(KeyUsageLog.tokens_total).label("tokens"),
        ).where(
            KeyUsageLog.created_at >= month_start,
            KeyUsageLog.status == "success",
        )
        if user_id and user_id != 'anonymous':
            stmt_month = stmt_month.where(KeyUsageLog.user_id == user_id)
        result_month = await session.execute(stmt_month)
        month = result_month.one()

        return {
            "today_requests": today.requests or 0,
            "today_tokens": today.tokens or 0,
            "month_requests": month.requests or 0,
            "month_tokens": month.tokens or 0,
        }
