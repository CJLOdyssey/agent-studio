"""run 续写 API——「继续生成」功能，直接在 uvicorn 进程中运行。"""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from auth import get_user_id
from core.error_codes import ErrorCode, error_response
from core.infra.logging_config import get_logger
from routers.runs import RunResponse
from services.run_service import run_service

logger = get_logger(__name__)
router = APIRouter(tags=["runs"])


class CompleteRunRequest(BaseModel):
    content: str = Field(default="")
    session_id: str | None = None
    thinking: str | None = None
    model: str | None = None
    question: str | None = None


@router.post("/api/runs/complete", response_model=RunResponse)
async def create_complete_run(req: CompleteRunRequest, request: Request) -> Any:
    """创建续写 run——不带思考/工具地流式输出原始 LLM 结果。

    用于前端「继续生成」功能，向被中断的 agent 消息追加内容，而不触发
    LangGraph 流水线（无 thinking_stream、无工具调用、无聊天历史）。
    """
    content = (req.content or "").strip()
    user_id = get_user_id(request)

    try:
        result = await run_service.continue_run(
            content=content,
            session_id=req.session_id,
            user_id=user_id,
            thinking=req.thinking,
            model=req.model,
            question=req.question,
        )
        return RunResponse(**result)
    except ValueError as e:
        raise error_response(ErrorCode.INVALID_REQUEST, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Complete pipeline failed for run")
        raise error_response(ErrorCode.INTERNAL_ERROR) from e
