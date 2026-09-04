"""带慢查询检测的数据库引擎与会话工厂。"""

import os
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from db.base import Base
from sqlalchemy import (
    event,
    text,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from core.infra.logging_config import get_logger

logger = get_logger(__name__)

# 超过该阈值（秒）的查询会以 warning 级别记录
SLOW_QUERY_THRESHOLD = 0.5

# 以 .env 作为兜底 —— 绝不覆盖已设置的环境变量（标准 dotenv 语义）。
# 避免测试夹具（在导入 core 模块前设置了如 AUTH_MODE=legacy）被 backend/.env 静默覆盖。
_env_file = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _, _value = _line.partition("=")
            _key = _key.strip()
            _value = _value.strip().strip('"').strip("'")
            if _key:
                os.environ.setdefault(_key, _value)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/backend",
)

_async_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def _attach_slow_query_listeners(engine: AsyncEngine) -> None:
    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def _before_execute(
        conn: Any, cursor: Any, statement: Any, parameters: Any, context: Any, executemany: Any
    ) -> None:
        conn.info.setdefault("_query_start", []).append(time.time())

    @event.listens_for(engine.sync_engine, "after_cursor_execute")
    def _after_execute(conn: Any, cursor: Any, statement: Any, parameters: Any, context: Any, executemany: Any) -> None:
        start = conn.info["_query_start"].pop()
        elapsed = time.time() - start
        if elapsed > SLOW_QUERY_THRESHOLD:
            # 截断长语句，避免日志刷屏
            stmt = statement[:300] if isinstance(statement, str) else str(statement)[:300]
            logger.warning(
                "Slow query (%.2fs): %s",
                elapsed,
                stmt,
            )


def get_async_engine() -> AsyncEngine:
    """返回或创建单例异步 SQLAlchemy 引擎。"""
    global _async_engine
    if _async_engine is None:
        pool_size = int(os.environ.get("DATABASE_POOL_SIZE", "20"))
        max_overflow = int(os.environ.get("DATABASE_POOL_OVERFLOW", "10"))
        kwargs: dict[str, object] = dict(echo=False)
        if pool_size == 0:
            kwargs["poolclass"] = NullPool
        else:
            kwargs["poolclass"] = None
            kwargs["pool_size"] = pool_size
            kwargs["max_overflow"] = max_overflow
            kwargs["pool_pre_ping"] = True
            kwargs["pool_recycle"] = 3600
        _async_engine = create_async_engine(DATABASE_URL, **kwargs)
        _attach_slow_query_listeners(_async_engine)
    return _async_engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """返回或创建单例异步会话工厂。"""
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(get_async_engine(), expire_on_commit=False)
    return _async_session_factory


def dispose_engine() -> None:
    """释放单例异步引擎的连接池。

    在应用关闭时调用，以释放池化连接及其事件循环资源。引擎对象本身保留：
    测试在 TestClient 生命周期内复用模块级引擎（丢弃它会重建全新的 ``:memory:``
    SQLite 数据库并丢失所有表）。
    """
    global _async_engine
    if _async_engine is not None:
        _async_engine.sync_engine.dispose()


async def init_db() -> None:
    """首次运行时引导创建数据库表。

    使用幂等的 create_all() —— 仅创建尚不存在的表。对于已有数据的生产部署，
    请改用 Alembic 迁移：

        alembic upgrade head

    迁移历史见 alembic/versions/。
    """
    # 惰性注册 checkpoint 模型，避免循环导入
    from checkpoint import CheckpointDB  # noqa: F401

    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 企业版：为现有 sessions 表的 agent_id 添加外键 + 索引
        await conn.execute(
            text(
                """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'sessions_agent_id_fkey'
                ) THEN
                    UPDATE sessions SET agent_id = NULL
                    WHERE agent_id IS NOT NULL
                    AND agent_id NOT IN (
                        SELECT id FROM agent_configs
                    );
                    ALTER TABLE sessions
                    ADD CONSTRAINT sessions_agent_id_fkey
                    FOREIGN KEY (agent_id) REFERENCES agent_configs(id)
                    ON DELETE SET NULL;
                END IF;
            END $$;
        """
            )
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sessions_agent_id ON sessions(agent_id);"))
        await conn.execute(
            text(
                """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sessions' AND column_name = 'kind'
                ) THEN
                    ALTER TABLE sessions ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'normal';
                    UPDATE sessions SET kind = 'agent' WHERE agent_id IS NOT NULL;
                END IF;
            END $$;
        """
            )
        )

    from services.seed_service import seed_default_roles_and_admin  # noqa: F401

    await seed_default_roles_and_admin()
    from services.seed_service import seed_builtin_tools  # noqa: F401

    await seed_builtin_tools()


async def get_session() -> AsyncIterator[AsyncSession]:
    """产出数据库会话的异步生成器（FastAPI Depends）。"""
    factory = get_session_factory()
    async with factory() as session:
        yield session


__all__ = [
    "DATABASE_URL",
    "dispose_engine",
    "get_async_engine",
    "get_session",
    "get_session_factory",
    "init_db",
]
