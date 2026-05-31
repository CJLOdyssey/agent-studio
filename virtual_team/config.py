import logging
import os

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

REQUIRED_VARS = ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"]


class TeamConfig(BaseModel):
    api_key: str = Field(default="")
    api_base: str | None = Field(default=None)
    model: str = Field(default="gpt-4o", min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_rounds: int = Field(default=5, ge=1)
    timeout: int = Field(default=120, ge=10)
    max_retries: int = Field(default=3, ge=0)

    def validate_required(self) -> list[str]:
        errors: list[str] = []
        if not self.api_key:
            errors.append(f"API key 未配置。请设置环境变量: {' 或 '.join(REQUIRED_VARS)}")
        if not self.model:
            errors.append(f"模型名称未配置。请设置环境变量 OPENAI_MODEL")
        return errors

    def build_llm_config(self) -> dict:
        config_list = [{
            "model": self.model,
            "api_key": self.api_key,
            "timeout": self.timeout,
            "max_retries": self.max_retries,
        }]
        if self.api_base:
            config_list[0]["base_url"] = self.api_base
        return {
            "config_list": config_list,
            "temperature": self.temperature,
            "max_retries": self.max_retries,
        }


def load_config(validate: bool = True) -> TeamConfig:
    api_key = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    api_base = os.environ.get("OPENAI_BASE_URL") or None
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")
    temperature = _safe_float("TEMPERATURE", 0.7)
    max_rounds = _safe_int("MAX_ROUNDS", 5)
    timeout = _safe_int("TIMEOUT", 120)
    max_retries = _safe_int("MAX_RETRIES", 3)
    cfg = TeamConfig(
        api_key=api_key,
        api_base=api_base,
        model=model,
        temperature=temperature,
        max_rounds=max_rounds,
        timeout=timeout,
        max_retries=max_retries,
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
