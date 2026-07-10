"""Celery task registry."""


from virtual_team.broker import celery_app
from virtual_team.logging_config import get_logger
from virtual_team.mock_fallback import ENABLE as ENABLE_MOCK_FALLBACK
from .helpers import _report_run_error, _run_async, _try_mock_fallback
from .pipeline import _run_agent_pipeline
from .complete_pipeline import _complete_pipeline

logger = get_logger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=5)
def run_agent(
    self,
    requirement: str,
    run_id: str | None = None,
    session_id: str | None = None,
    agent_id: str | None = None,
    api_key: str | None = None,
    api_base: str | None = None,
    model: str | None = None,
):
    logger.info("Agent task | run=%s | session=%s | agent=%s", run_id, session_id, agent_id)
    assert run_id is not None, "run_id must be provided"

    try:
        return _run_async(
            _run_agent_pipeline(
                requirement,
                run_id,
                session_id,
                agent_id,
                api_key=api_key,
                api_base=api_base,
                model=model,
            )
        )
    except Exception as exc:
        logger.exception("Agent failed | run=%s", run_id)

        if ENABLE_MOCK_FALLBACK:
            result = _try_mock_fallback(requirement, run_id, session_id, exc)
            if result:
                return result

        _report_run_error(run_id, exc)
        self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Completion task — raw LLM streaming without LangGraph / thinking / tools
# Used by the "继续生成" flow on the frontend.
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, max_retries=2, default_retry_delay=5)
def complete_agent(
    self,
    content: str,
    run_id: str,
    api_key: str,
    api_base: str | None = None,
    model: str | None = None,
    thinking: str | None = None,
):
    return _run_async(_complete_pipeline(content, run_id, api_key, api_base, model, thinking))
