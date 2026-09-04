"""成本 API 的 Pydantic 模型与纯辅助函数。"""

import json
import os
from datetime import date
from pathlib import Path
from typing import Any

from cost.time_window import resolve_window
from fastapi import HTTPException
from pydantic import BaseModel

_BUDGET_FILE = Path(os.environ.get("COST_BUDGET_FILE", "data/cost_budget.json"))


class BudgetUpdate(BaseModel):
    daily_limit: float = 0.0
    monthly_limit: float = 0.0


def _window_or_422(
    start_date: date | None,
    end_date: date | None,
    days: int,
) -> Any:
    """解析时间窗口，将非法范围映射为 HTTP 422。

    领域层抛出 ValueError 且对 HTTP 一无所知；转换在这里进行，
    位于边界（依赖倒置）。
    """
    try:
        return resolve_window(start_date, end_date, days)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _load_budget() -> dict[str, Any]:
    if _BUDGET_FILE.exists():
        try:
            return dict(json.loads(_BUDGET_FILE.read_text()))
        except (json.JSONDecodeError, OSError):
            pass
    return {"daily_limit": 0.0, "monthly_limit": 0.0}


def _save_budget(budget: dict[str, Any]) -> None:
    _BUDGET_FILE.parent.mkdir(parents=True, exist_ok=True)
    _BUDGET_FILE.write_text(json.dumps(budget, indent=2))
