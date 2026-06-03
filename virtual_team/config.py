import os

from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)

REQUIRED_VARS = ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"]


class TeamConfig(BaseModel):
    model_config = {"extra": "forbid"}

    api_key: str = Field(default="", repr=False)
    api_base: str | None = Field(default=None)
    model: str = Field(default="gpt-4o", min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_rounds: int = Field(default=5, ge=1)
    timeout: int = Field(default=120, ge=10)
    max_retries: int = Field(default=3, ge=0)
    max_requirement_length: int = Field(default=2000, ge=1, le=10000)

    def __repr__(self) -> str:
        safe = self.model_dump()
        safe["api_key"] = "***" if self.api_key else "(unset)"
        return f"TeamConfig({safe})"

    def validate_required(self) -> list[str]:
        errors: list[str] = []
        if not self.api_key:
            errors.append(f"API key 未配置。请设置环境变量: {' 或 '.join(REQUIRED_VARS)}")
        return errors

def load_config(validate: bool = True) -> TeamConfig:
    api_key = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    api_base = os.environ.get("OPENAI_BASE_URL") or None
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")
    temperature = _safe_float("TEMPERATURE", 0.7)
    max_rounds = _safe_int("MAX_ROUNDS", 5)
    timeout = _safe_int("TIMEOUT", 120)
    max_retries = _safe_int("MAX_RETRIES", 3)
    max_requirement_length = _safe_int("MAX_REQUIREMENT_LENGTH", 2000)
    cfg = TeamConfig(
        api_key=api_key,
        api_base=api_base,
        model=model,
        temperature=temperature,
        max_rounds=max_rounds,
        timeout=timeout,
        max_retries=max_retries,
        max_requirement_length=max_requirement_length,
    )
    if validate:
        errors = cfg.validate_required()
        for err in errors:
            logger.warning("配置缺失: %s", err)
    return cfg


def _safe_float(key: str, default: float) -> float:
    try:
        return float(os.environ[key])
    except (KeyError, ValueError, TypeError):
        return default


def _safe_int(key: str, default: int) -> int:
    try:
        return int(os.environ[key])
    except (KeyError, ValueError, TypeError):
        return default
