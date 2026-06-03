import os
import httpx
from typing import Any

from virtual_team.logging_config import get_logger
from virtual_team.config import load_config

logger = get_logger(__name__)


class LLMClient:
    def __init__(self):
        self._config = None

    def _get_config(self):
        if self._config is None:
            self._config = load_config()
        return self._config

    def is_available(self) -> bool:
        config = self._get_config()
        return bool(config.api_key)

    async def generate_code(self, description: str, language: str = "python") -> str | None:
        config = self._get_config()
        if not config.api_key:
            return None

        base_url = config.api_base or "https://api.deepseek.com"
        model = config.model or "deepseek-v4-flash"

        prompt = f"""根据以下描述生成 {language} 工具代码：

描述：{description}

要求：
1. 生成完整、可执行的代码
2. 包含函数定义、参数类型提示
3. 包含 docstring 说明
4. 包含异常处理
5. 只返回代码，不要解释

函数名应该语义化，能体现功能。"""

        messages = [
            {
                "role": "system",
                "content": "你是一个代码生成专家。根据用户描述生成完整、可执行的代码。只返回代码，不要其他内容。",
            },
            {"role": "user", "content": prompt},
        ]

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{base_url}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {config.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 2000,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return self._extract_code(content)
        except Exception as e:
            logger.error("LLM code generation failed: %s", e)
            return None

    def _extract_code(self, content: str) -> str:
        if "```python" in content:
            start = content.index("```python") + 9
            end = content.index("```", start)
            return content[start:end].strip()
        if "```" in content:
            start = content.index("```") + 3
            end = content.index("```", start)
            return content[start:end].strip()
        return content.strip()


llm_client = LLMClient()
