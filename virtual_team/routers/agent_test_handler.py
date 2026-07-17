"""Agent config test endpoint: runs a single LLM call with agent settings."""

import time
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["agents_test"])


class AgentTestResult(BaseModel):
    success: bool
    message: str
    duration_ms: int = 0


@router.post("/api/agents/{agent_id}/test")
async def test_agent(agent_id: str) -> Any:
    """Test an agent config by running a single LLM call with its settings."""
    from virtual_team.repository.agents import get_agent_config

    agent = await get_agent_config(agent_id)
    if not agent:
        raise error_response(ErrorCode.AGENT_NOT_FOUND, detail="Agent not found")

    start = time.monotonic()
    try:
        import httpx

        from virtual_team.config import load_config
        from virtual_team.repository.keys import get_default_api_key  # type: ignore[attr-defined]

        cfg = load_config()
        effective_model = agent.model or cfg.model
        key_cfg = await get_default_api_key("system")
        if not key_cfg:
            return AgentTestResult(
                success=False, message="No API key configured", duration_ms=0
            )

        base_url = (key_cfg.get("base_url") or "https://api.deepseek.com").rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {key_cfg['api_key']}",
            "Content-Type": "application/json",
        }
        body = {
            "model": effective_model,
            "messages": [
                {"role": "system", "content": agent.system_prompt or "You are a helpful assistant."},
                {"role": "user", "content": "Hello, respond with 'OK' if you are working."},
            ],
            "max_tokens": 10,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.post(url, json=body, headers=headers)
            dur = int((time.monotonic() - start) * 1000)
            if resp.status_code == 200:
                return AgentTestResult(
                    success=True,
                    message=f"LLM responded ({effective_model})",
                    duration_ms=dur,
                )
            return AgentTestResult(
                success=False,
                message=f"HTTP {resp.status_code}: {resp.text[:200]}",
                duration_ms=dur,
            )
    except Exception as e:
        dur = int((time.monotonic() - start) * 1000)
        return AgentTestResult(success=False, message=str(e), duration_ms=dur)
