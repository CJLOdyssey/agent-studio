"""Cost tracking API endpoints."""

from cost.performance_tracker import get_performance_tracker
from cost.token_tracker import get_token_tracker
from fastapi import APIRouter, Depends, Query

from auth.auth_middleware import get_current_user

router = APIRouter(prefix="/api/cost", tags=["cost"])


@router.get("/token-usage")
async def get_token_usage(
    run_id: str = Query(..., description="Run ID to get token usage for"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get token usage details for a specific run."""
    tracker = get_token_tracker()
    usages = await tracker.get_usage_by_run(run_id)

    total_tokens = sum(u["total_tokens"] for u in usages)
    total_cost = sum(u["cost_usd"] for u in usages)

    return {
        "run_id": run_id,
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost,
        "usages": usages,
    }


@router.get("/summary")
async def get_cost_summary(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: int = Query(7, ge=1, le=365, description="Number of days to summarize"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get token usage summary for a team or all teams."""
    tracker = get_token_tracker()
    summary = await tracker.get_summary(team_id=team_id, days=days)
    return summary


@router.get("/models")
async def get_model_pricing(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get available models and their pricing."""
    from cost.token_tracker import MODEL_PRICING

    models = []
    for model_name, pricing in MODEL_PRICING.items():
        models.append(
            {
                "model": model_name,
                "prompt_cost_per_1k": pricing["prompt"],
                "completion_cost_per_1k": pricing["completion"],
            }
        )

    return {"models": models}


@router.get("/daily-trend")
async def get_daily_trend(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: int = Query(7, ge=1, le=365, description="Number of days"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get daily cost trend."""
    tracker = get_token_tracker()
    trend = await tracker.get_daily_trend(team_id=team_id, days=days)
    return {"trend": trend}


@router.get("/attribution")
async def get_cost_attribution(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: int = Query(7, ge=1, le=365, description="Number of days"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get cost attribution by team and node."""
    tracker = get_token_tracker()
    attribution = await tracker.get_cost_attribution(team_id=team_id, days=days)
    return attribution


@router.get("/performance/summary")
async def get_performance_summary(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: int = Query(7, ge=1, le=365, description="Number of days"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get overall performance summary."""
    tracker = get_performance_tracker()
    summary = await tracker.get_performance_summary(team_id=team_id, days=days)
    return summary


@router.get("/performance/trend")
async def get_performance_trend(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: int = Query(7, ge=1, le=365, description="Number of days"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get daily performance trend."""
    tracker = get_performance_tracker()
    trend = await tracker.get_performance_trend(team_id=team_id, days=days)
    return trend


@router.get("/performance/ranking")
async def get_agent_ranking(
    team_id: str | None = Query(None, description="Team ID (optional)"),
    days: int = Query(7, ge=1, le=365, description="Number of days"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get agent/node performance ranking."""
    tracker = get_performance_tracker()
    ranking = await tracker.get_agent_ranking(team_id=team_id, days=days)
    return ranking
