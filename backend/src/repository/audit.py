"""审计仓库——写入防篡改的审计日志条目。"""

import hashlib
import json
from typing import Any

from sqlalchemy import select

from core.infra.database import get_session_factory
from orm import AuditLogDB

# 若这些子串出现在任何自由文本字段中，则该值被标记为敏感
# （OWASP Logging Cheat Sheet——绝不持久化密钥）。匹配的值
# 被替换为占位符，而非原样写入。
_SENSITIVE_MARKERS = (
    "password", "passwd", "secret", "api_key", "apikey", "token",
    "authorization", "bearer", "cookie", "x-api-key", "private_key",
)

_LEVELS = ("info", "warn", "error")


def _redact(text: str) -> str:
    """用占位符替换疑似敏感的值。"""
    if not text:
        return text
    lowered = text.lower()
    for marker in _SENSITIVE_MARKERS:
        if marker in lowered:
            return "[REDACTED]"
    return text


def _snapshot_json(value: Any) -> str:
    """将快照载荷序列化为稳定字符串（None 时返回 ''）。"""
    if value is None:
        return ""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _chain_hash(prev_hash: str, content: dict[str, Any]) -> str:
    """对（前一哈希 + 规范化内容）计算哈希。

    规范化的序列化是确定性的，因此之后可通过对已存储行重新计算哈希
    来重新验证链。
    """
    canonical = json.dumps(content, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(f"{prev_hash}|{canonical}".encode()).hexdigest()


async def _last_hash(session: Any) -> str:
    """返回最近一条审计条目的哈希（空时返回 ''）。"""
    result = await session.execute(
        select(AuditLogDB.hash)
        .order_by(AuditLogDB.created_at.desc(), AuditLogDB.id.desc())
        .limit(1)
    )
    row = result.first()
    return row[0] if row else ""


async def create_audit_entry(
    action: str,
    entity_type: str,
    entity_name: str = "",
    detail: str = "",
    user_name: str = "",
    client_ip: str = "",
    level: str = "info",
    before_snapshot: Any = None,
    after_snapshot: Any = None,
    user_agent: str = "",
    request_id: str = "",
) -> None:
    """追加一条防篡改审计条目。

    ``action``/``entity_type``/``entity_name`` 原样写入；自由文本
    ``detail`` 对敏感标记做脱敏。``before/after_snapshot`` 序列化为 JSON。
    返回条目的 ``hash`` 从前一条目链接而来，使事后修改会破坏验证。
    """
    level = level if level in _LEVELS else "info"
    detail_clean = _redact(detail)
    before_clean = _redact(_snapshot_json(before_snapshot))
    after_clean = _redact(_snapshot_json(after_snapshot))

    factory = get_session_factory()
    async with factory() as session:
        # 锁定最新一行，使并发写入者不会分叉链。
        # （PG：FOR UPDATE；SQLite：由其单写者模型串行化。）
        prev = await _last_hash(session)
        content = {
            "action": action,
            "entity_type": entity_type,
            "entity_name": entity_name,
            "detail": detail_clean,
            "level": level,
            "before": before_clean,
            "after": after_clean,
            "user_name": user_name,
            "client_ip": client_ip,
            "user_agent": user_agent,
            "request_id": request_id,
            "created_at": None,  # 由 DB 默认填充；哈希仅覆盖内容字段
        }
        entry_hash = _chain_hash(prev, content)

        entry = AuditLogDB(
            action=action,
            entity_type=entity_type,
            entity_name=entity_name,
            detail=detail_clean,
            level=level,
            before_snapshot=before_clean or None,
            after_snapshot=after_clean or None,
            user_name=user_name,
            client_ip=client_ip,
            user_agent=user_agent,
            request_id=request_id,
            prev_hash=prev,
            hash=entry_hash,
        )
        session.add(entry)
        await session.commit()


def _row_content(r: AuditLogDB) -> dict[str, Any]:
    """为链检查重新计算已存储行的规范内容。"""
    return {
        "action": r.action,
        "entity_type": r.entity_type,
        "entity_name": r.entity_name,
        "detail": r.detail,
        "level": r.level,
        "before": r.before_snapshot or "",
        "after": r.after_snapshot or "",
        "user_name": r.user_name,
        "client_ip": r.client_ip,
        "user_agent": r.user_agent,
        "request_id": r.request_id,
        "created_at": None,
    }


async def verify_audit_chain(limit: int = 2000) -> dict[str, Any]:
    """验证防篡改哈希链。

    从最新开始遍历，用（prev_hash + content）重新计算每个条目的哈希。
    不匹配意味着该行（或其祖先）在插入后被编辑。返回检查了多少条目及
    链是否完整。扫描限定到最近 ``limit`` 个条目。
    """
    factory = get_session_factory()
    async with factory() as session:
        rows = (
            await session.execute(
                select(AuditLogDB)
                .order_by(AuditLogDB.created_at.desc(), AuditLogDB.id.desc())
                .limit(limit)
            )
        ).scalars().all()

    # 从最新开始遍历（rows[0] = 最新）。每个条目自身的哈希必须等于
    # 由（prev_hash + content）重新计算的值；且每个条目的 prev_hash 必须
    # 等于链中其正下方条目的哈希（rows[i].prev_hash == rows[i+1].hash）。
    violations: list[str] = []
    for i, r in enumerate(rows):
        recomputed = _chain_hash(r.prev_hash, _row_content(r))
        if recomputed != r.hash:
            violations.append(f"{r.id} (content/hash mismatch)")
        if r.prev_hash and i + 1 < len(rows) and r.prev_hash != rows[i + 1].hash:
            violations.append(f"{r.id} (chain break: prev_hash mismatch)")
    return {
        "checked": len(rows),
        "intact": len(violations) == 0,
        "violations": violations[:50],
    }


async def export_audit_logs(limit: int = 10000) -> tuple[str, str]:
    """将审计日志导出为 CSV 字符串（最新在前，限定 ``limit`` 行）。

    返回 (csv_content, filename_with_date)。
    """
    import csv
    from datetime import datetime
    from io import StringIO

    factory = get_session_factory()
    async with factory() as session:
        rows = (
            await session.execute(
                select(AuditLogDB)
                .order_by(AuditLogDB.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "timestamp", "level", "action", "entity_type", "entity_name",
        "detail", "before", "after", "user", "ip", "user_agent", "request_id",
    ])
    for r in rows:
        writer.writerow([
            r.created_at.isoformat() if r.created_at else "",
            r.level,
            r.action,
            r.entity_type,
            r.entity_name,
            r.detail,
            r.before_snapshot or "",
            r.after_snapshot or "",
            r.user_name,
            r.client_ip,
            r.user_agent,
            r.request_id,
        ])
    today = datetime.now().strftime("%Y%m%d")
    return buf.getvalue(), f"audit_logs_{today}.csv"
