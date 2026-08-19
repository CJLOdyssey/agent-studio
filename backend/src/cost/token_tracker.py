"""Token usage tracking and cost calculation."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select

from core.infra.database import get_session_factory
from core.infra.logging_config import get_logger
from orm.token_usage import TokenUsageDB

logger = get_logger(__name__)

# Model pricing (USD per 1K tokens)
MODEL_PRICING = {
    "gpt-4": {"prompt": 0.03, "completion": 0.06},
    "gpt-4-turbo": {"prompt": 0.01, "completion": 0.03},
    "gpt-3.5-turbo": {"prompt": 0.0005, "completion": 0.0015},
    "deepseek-chat": {"prompt": 0.00014, "completion": 0.00028},
    "deepseek-coder": {"prompt": 0.00014, "completion": 0.00028},
}


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate cost in USD for a given model and token usage."""
    pricing = MODEL_PRICING.get(model, {"prompt": 0.001, "completion": 0.002})
    prompt_cost = (prompt_tokens / 1000) * pricing["prompt"]
    completion_cost = (completion_tokens / 1000) * pricing["completion"]
    return prompt_cost + completion_cost


class TokenTracker:
    """Tracks token usage and costs for workflow executions."""

    async def record_usage(
        self,
        run_id: str,
        node_id: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        team_id: str | None = None,
    ) -> None:
        """Record token usage for a workflow node execution."""
        total_tokens = prompt_tokens + completion_tokens
        cost_usd = calculate_cost(model, prompt_tokens, completion_tokens)

        factory = get_session_factory()
        async with factory() as session:
            usage = TokenUsageDB(
                id=str(uuid4()),
                run_id=run_id,
                node_id=node_id,
                team_id=team_id,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost_usd,
            )
            session.add(usage)
            await session.commit()

        logger.debug(
            f"Recorded token usage: run={run_id}, node={node_id}, "
            f"model={model}, tokens={total_tokens}, cost=${cost_usd:.6f}"
        )

    async def get_usage_by_run(self, run_id: str) -> list[dict[str, Any]]:
        """Get token usage for a specific run."""
        factory = get_session_factory()
        async with factory() as session:
            stmt = (
                select(TokenUsageDB)
                .where(TokenUsageDB.run_id == run_id)
                .order_by(TokenUsageDB.timestamp)
            )
            result = await session.execute(stmt)
            usages = result.scalars().all()

            return [
                {
                    "id": u.id,
                    "run_id": u.run_id,
                    "node_id": u.node_id,
                    "model": u.model,
                    "prompt_tokens": u.prompt_tokens,
                    "completion_tokens": u.completion_tokens,
                    "total_tokens": u.total_tokens,
                    "cost_usd": u.cost_usd,
                    "timestamp": u.timestamp.isoformat(),
                }
                for u in usages
            ]

    async def get_summary(
        self,
        team_id: str | None = None,
        days: int = 7,
    ) -> dict[str, Any]:
        """Get token usage summary for a team or all teams."""
        factory = get_session_factory()
        async with factory() as session:
            # Base query
            stmt = select(TokenUsageDB)
            if team_id:
                stmt = stmt.where(TokenUsageDB.team_id == team_id)

            # Time filter
            cutoff = datetime.utcnow() - __import__("datetime").timedelta(days=days)
            stmt = stmt.where(TokenUsageDB.timestamp >= cutoff)

            result = await session.execute(stmt)
            usages = result.scalars().all()

            # Aggregate
            total_tokens = sum(u.total_tokens for u in usages)
            total_cost = sum(u.cost_usd for u in usages)
            total_prompt = sum(u.prompt_tokens for u in usages)
            total_completion = sum(u.completion_tokens for u in usages)

            # By model
            by_model: dict[str, dict[str, Any]] = {}
            for u in usages:
                if u.model not in by_model:
                    by_model[u.model] = {
                        "tokens": 0,
                        "cost_usd": 0.0,
                        "calls": 0,
                    }
                by_model[u.model]["tokens"] += u.total_tokens
                by_model[u.model]["cost_usd"] += u.cost_usd
                by_model[u.model]["calls"] += 1

            # By node
            by_node: dict[str, dict[str, Any]] = {}
            for u in usages:
                if u.node_id not in by_node:
                    by_node[u.node_id] = {
                        "tokens": 0,
                        "cost_usd": 0.0,
                        "calls": 0,
                    }
                by_node[u.node_id]["tokens"] += u.total_tokens
                by_node[u.node_id]["cost_usd"] += u.cost_usd
                by_node[u.node_id]["calls"] += 1

            return {
                "period_days": days,
                "total_tokens": total_tokens,
                "total_cost_usd": total_cost,
                "total_prompt_tokens": total_prompt,
                "total_completion_tokens": total_completion,
                "total_calls": len(usages),
                "by_model": by_model,
                "by_node": by_node,
            }

    async def get_daily_trend(
        self,
        team_id: str | None = None,
        days: int = 7,
    ) -> list[dict[str, Any]]:
        """Get daily cost trend."""
        factory = get_session_factory()
        async with factory() as session:
            cutoff = datetime.now(UTC) - timedelta(days=days)
            stmt = (
                select(
                    func.date(TokenUsageDB.timestamp).label("day"),
                    func.sum(TokenUsageDB.total_tokens).label("total_tokens"),
                    func.sum(TokenUsageDB.cost_usd).label("total_cost"),
                    func.count(TokenUsageDB.id).label("calls"),
                )
                .where(TokenUsageDB.timestamp >= cutoff)
            )
            if team_id:
                stmt = stmt.where(TokenUsageDB.team_id == team_id)
            stmt = stmt.group_by(func.date(TokenUsageDB.timestamp)).order_by("day")

            result = await session.execute(stmt)
            rows = result.all()

            return [
                {
                    "day": str(r.day),
                    "total_tokens": r.total_tokens or 0,
                    "total_cost": float(r.total_cost or 0),
                    "calls": r.calls or 0,
                }
                for r in rows
            ]

    async def get_cost_attribution(
        self,
        team_id: str | None = None,
        days: int = 7,
    ) -> dict[str, Any]:
        """Get cost attribution by team and node."""
        factory = get_session_factory()
        async with factory() as session:
            cutoff = datetime.now(UTC) - timedelta(days=days)

            # By team
            team_stmt = (
                select(
                    TokenUsageDB.team_id,
                    func.sum(TokenUsageDB.cost_usd).label("cost"),
                    func.sum(TokenUsageDB.total_tokens).label("tokens"),
                    func.count(TokenUsageDB.id).label("calls"),
                )
                .where(TokenUsageDB.timestamp >= cutoff)
            )
            if team_id:
                team_stmt = team_stmt.where(TokenUsageDB.team_id == team_id)
            team_stmt = team_stmt.group_by(TokenUsageDB.team_id).order_by(func.sum(TokenUsageDB.cost_usd).desc())

            team_result = await session.execute(team_stmt)
            team_rows = team_result.all()

            total_cost = sum(float(r.cost or 0) for r in team_rows)
            by_team = []
            for r in team_rows:
                cost = float(r.cost or 0)
                by_team.append({
                    "team_id": r.team_id or "unassigned",
                    "cost_usd": cost,
                    "tokens": r.tokens or 0,
                    "calls": r.calls or 0,
                    "percentage": round(cost / total_cost * 100, 1) if total_cost > 0 else 0,
                })

            # By node
            node_stmt = (
                select(
                    TokenUsageDB.node_id,
                    func.sum(TokenUsageDB.cost_usd).label("cost"),
                    func.sum(TokenUsageDB.total_tokens).label("tokens"),
                    func.count(TokenUsageDB.id).label("calls"),
                )
                .where(TokenUsageDB.timestamp >= cutoff)
            )
            if team_id:
                node_stmt = node_stmt.where(TokenUsageDB.team_id == team_id)
            node_stmt = node_stmt.group_by(TokenUsageDB.node_id).order_by(func.sum(TokenUsageDB.cost_usd).desc())

            node_result = await session.execute(node_stmt)
            node_rows = node_result.all()

            by_node = []
            for r in node_rows:
                cost = float(r.cost or 0)
                by_node.append({
                    "node_id": r.node_id,
                    "cost_usd": cost,
                    "tokens": r.tokens or 0,
                    "calls": r.calls or 0,
                    "avg_tokens": round((r.tokens or 0) / (r.calls or 1)),
                    "percentage": round(cost / total_cost * 100, 1) if total_cost > 0 else 0,
                })

            return {
                "period_days": days,
                "total_cost_usd": total_cost,
                "by_team": by_team,
                "by_node": by_node,
            }


# Singleton
_token_tracker: TokenTracker | None = None


def get_token_tracker() -> TokenTracker:
    """Get the token tracker singleton."""
    global _token_tracker
    if _token_tracker is None:
        _token_tracker = TokenTracker()
    return _token_tracker
