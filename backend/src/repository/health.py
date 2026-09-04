from __future__ import annotations

from typing import Any

from sqlalchemy import text

from core.infra.database import get_session_factory


async def check_database() -> str:
    """SELECT 1 成功返回 'ok'，否则返回错误消息。"""
    try:
        factory = get_session_factory()
        async with factory() as session:
            await session.execute(text("SELECT 1"))
        return "ok"
    except Exception as e:
        return str(e)


async def check_redis() -> str:
    """Redis ping 成功返回 'ok'，否则返回错误消息。"""
    try:
        from broker import get_redis

        r = get_redis()
        await r.ping()
        return "ok"
    except Exception as e:
        return str(e)


async def check_api_response_time() -> dict[str, Any]:
    """检查最近请求的平均 API 响应时间。"""
    try:
        factory = get_session_factory()
        async with factory() as session:
            # 检查是否有请求日志表
            result = await session.execute(
                text("""
                    SELECT AVG(response_time_ms) as avg_ms, MAX(response_time_ms) as max_ms
                    FROM api_request_logs
                    WHERE created_at > NOW() - INTERVAL '1 hour'
                """)
            )
            row = result.first()
            if row and row[0] is not None:
                return {
                    "status": "ok",
                    "avg_ms": round(float(row[0]), 2),
                    "max_ms": round(float(row[1]), 2),
                }
            return {"status": "ok", "avg_ms": 0, "max_ms": 0}
    except Exception:
        # 表可能不存在，无数据返回 ok
        return {"status": "ok", "avg_ms": 0, "max_ms": 0}


async def check_queue_status() -> dict[str, Any]:
    """检查后台任务队列状态。"""
    try:
        from broker import get_redis

        r = get_redis()
        # 检查队列长度
        queue_keys = await r.keys("queue:*")
        total_queued = 0
        for key in queue_keys:
            length = await r.llen(key)
            total_queued += length

        return {
            "status": "ok" if total_queued < 100 else "warning",
            "queued_jobs": total_queued,
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


async def get_enhanced_health() -> dict[str, Any]:
    """获取包含所有系统组件的综合健康检查。"""
    db_status = await check_database()
    redis_status = await check_redis()
    api_response = await check_api_response_time()
    queue_status = await check_queue_status()

    checks = {
        "database": db_status,
        "redis": redis_status,
        "api_response_time": api_response["status"] if api_response else "unknown",
        "queue_status": queue_status["status"],
    }

    # 确定整体健康状况
    healthy = db_status == "ok" and redis_status == "ok"
    status = "healthy" if healthy else "degraded"

    return {
        "status": status,
        "checks": checks,
        "details": {
            "api_response": api_response,
            "queue": queue_status,
        },
    }
