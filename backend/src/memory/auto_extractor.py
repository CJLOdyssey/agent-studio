"""Automatic memory extraction from conversations."""

import json
import re
from typing import Any

from langchain_core.messages import BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


EXTRACTION_PROMPT = """你是一个记忆提取专家。分析以下对话，提取需要长期记住的关键信息。

提取以下类型的信息：
1. 用户偏好（preferences）：语言、风格、格式等
2. 事实信息（facts）：职业、兴趣、背景等
3. 决策记录（decisions）：做出的重要决定
4. 上下文（context）：项目、任务、目标等

对话内容：
{conversation}

请以 JSON 格式输出，每个记忆条目包含：
- key: 唯一标识（如 "preference:language", "fact:occupation"）
- value: 记忆内容
- confidence: 置信度 0.0-1.0
- category: 类别（preference/fact/decision/context）

只输出 JSON，不要其他内容。如果没有值得记忆的信息，输出空数组 []。
"""


class MemoryExtractor:
    """Extracts memorable information from conversations."""

    def __init__(
        self,
        llm: ChatOpenAI | None = None,
        min_confidence: float = 0.6,
    ):
        self.llm = llm
        self.min_confidence = min_confidence

    async def extract_from_conversation(
        self,
        messages: list[BaseMessage],
        user_id: str,
        session_id: str,
    ) -> list[dict[str, Any]]:
        """Extract memory entries from a conversation."""
        if not self.llm:
            logger.warning("MemoryExtractor: no LLM configured, skipping extraction")
            return []

        # Format conversation
        conversation_text = self._format_messages(messages)

        # Skip very short conversations
        if len(conversation_text) < 100:
            return []

        prompt = EXTRACTION_PROMPT.format(conversation=conversation_text)

        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            content = response.content if isinstance(response.content, str) else str(response.content)

            # Parse JSON
            entries = self._parse_json_response(content)

            # Filter by confidence and add metadata
            filtered = []
            for entry in entries:
                if entry.get("confidence", 0) >= self.min_confidence:
                    entry["user_id"] = user_id
                    entry["session_id"] = session_id
                    filtered.append(entry)

            logger.info(f"Extracted {len(filtered)} memory entries from conversation")
            return filtered

        except Exception as e:
            logger.warning(f"Memory extraction failed: {e}")
            return []

    def _format_messages(self, messages: list[BaseMessage]) -> str:
        """Format messages for extraction."""
        parts = []
        for msg in messages[-20:]:  # Last 20 messages
            role = "用户" if isinstance(msg, HumanMessage) else "助手"
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            parts.append(f"{role}: {content}")
        return "\n".join(parts)

    def _parse_json_response(self, text: str) -> list[dict[str, Any]]:
        """Parse JSON from LLM response."""
        # Try to find JSON in the response
        json_match = re.search(r'\[[\s\S]*\]', text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # Try parsing the entire response
        try:
            result = json.loads(text)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

        return []


# Heuristic-based extractor (no LLM required)
class HeuristicMemoryExtractor:
    """Extract memories using pattern matching (no LLM)."""

    PATTERNS = {
        "preference:language": [
            r"我(?:喜欢|习惯|偏好)(?:使用|说|用)(\w+)",
            r"用(\w+)回答",
            r"请用(\w+)",
        ],
        "preference:style": [
            r"我(?:喜欢|偏好)(简洁|详细|正式|随意)(?:的)?(?:风格|回答)",
            r"(简洁|详细|正式|随意)(?:一点|一些)?(?:回答|回复)",
        ],
        "fact:occupation": [
            r"我是(\w+)(?:工程师|开发者|设计师|产品经理|学生|老师)",
            r"我(?:在|做)(?:从事)?(\w+)(?:工作|行业)",
        ],
    }

    def extract(
        self,
        text: str,
        user_id: str,
        session_id: str,
    ) -> list[dict[str, Any]]:
        """Extract memories using pattern matching."""
        entries = []

        for key, patterns in self.PATTERNS.items():
            for pattern in patterns:
                matches = re.findall(pattern, text)
                for match in matches:
                    value = match if isinstance(match, str) else match[0]
                    entries.append({
                        "key": key,
                        "value": value,
                        "confidence": 0.7,
                        "category": key.split(":")[0],
                        "user_id": user_id,
                        "session_id": session_id,
                    })

        return entries


# Singleton
_extractor: MemoryExtractor | None = None
_heuristic_extractor: HeuristicMemoryExtractor | None = None


def get_memory_extractor(llm: ChatOpenAI | None = None) -> MemoryExtractor:
    """Get memory extractor singleton."""
    global _extractor
    if _extractor is None:
        _extractor = MemoryExtractor(llm=llm)
    return _extractor


def get_heuristic_extractor() -> HeuristicMemoryExtractor:
    """Get heuristic extractor singleton."""
    global _heuristic_extractor
    if _heuristic_extractor is None:
        _heuristic_extractor = HeuristicMemoryExtractor()
    return _heuristic_extractor
