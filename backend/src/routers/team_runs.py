"""Team run approval endpoints — HITL human verdict for reviewer gates.

The reviewer gate in ``workflow/graph_builder.py`` polls the key written here
(``team:{run_id}:human_verdict``) and overrides its keyword verdict when the
key is present (non-blocking "optional human" mode).
"""

import json
from datetime import UTC, datetime
from typing import Any

from auth import CurrentUser, get_current_user
from broker import get_redis
from core.error_codes import ErrorCode, error_response
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from repository import get_run

router = APIRouter(tags=["team-runs"])

HUMAN_VERDICT_TTL = 600
HUMAN_VERDICT_KEY = "team:{run_id}:human_verdict"


class ApproveRequest(BaseModel):
    approved: bool
    note: str | None = None


@router.post("/api/team-runs/{run_id}/approve")
async def approve_run(
    run_id: str,
    body: ApproveRequest,
    current_user: CurrentUser = Depends(get_current_user),  # noqa: B008
) -> Any:
    """Record a human verdict that overrides the reviewer gate for a run."""
    run = await get_run(run_id)
    if run is None:
        raise error_response(ErrorCode.RUN_NOT_FOUND, detail="运行不存在")

    verdict = {
        "approved": body.approved,
        "note": body.note or "",
        "user_id": current_user.id,
        "ts": datetime.now(UTC).isoformat(),
    }
    r = get_redis()
    await r.set(
        HUMAN_VERDICT_KEY.format(run_id=run_id),
        json.dumps(verdict, ensure_ascii=False),
        ex=HUMAN_VERDICT_TTL,
    )
    return {"status": "ok", "run_id": run_id, "approved": body.approved}
