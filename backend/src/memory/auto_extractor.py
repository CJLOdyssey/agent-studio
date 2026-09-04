"""从对话中自动提取记忆。"""

import json
import re
from typing import Any, cast

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
    """从对话中提取值得记忆的信息。"""

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
        """从对话中提取记忆条目。"""
        if not self.llm:
            logger.warning("MemoryExtractor: no LLM configured, skipping extraction")
            return []

        # 格式化对话
        conversation_text = self._format_messages(messages)

        # 跳过过短的对话
        if len(conversation_text) < 100:
            return []

        prompt = EXTRACTION_PROMPT.format(conversation=conversation_text)

        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            content = response.content if isinstance(response.content, str) else str(response.content)

            # 解析 JSON
            entries = self._parse_json_response(content)

            # 按置信度过滤并附加元数据
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
        """格式化消息以便提取。"""
        parts = []
        for msg in messages[-20:]:  # 最近 20 条消息
            role = "用户" if isinstance(msg, HumanMessage) else "助手"
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            parts.append(f"{role}: {content}")
        return "\n".join(parts)

    def _parse_json_response(self, text: str) -> list[dict[str, Any]]:
        """从 LLM 响应中解析 JSON。"""
        # 尝试在响应中定位 JSON
        json_match = re.search(r'\[[\s\S]*\]', text)
        if json_match:
            try:
                return cast(list[dict[str, Any]], json.loads(json_match.group()))
            except json.JSONDecodeError:
                pass

        # 尝试解析整个响应
        try:
            result = json.loads(text)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

        return []


# 基于启发式的提取器（无需 LLM）
class HeuristicMemoryExtractor:
    """用模式匹配提取记忆（无需 LLM）。"""

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
        """用模式匹配提取记忆。"""
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


# 单例
_extractor: MemoryExtractor | None = None
_heuristic_extractor: HeuristicMemoryExtractor | None = None


def get_memory_extractor(llm: ChatOpenAI | None = None) -> MemoryExtractor:
    """获取记忆提取器单例。"""
    global _extractor
    if _extractor is None:
        _extractor = MemoryExtractor(llm=llm)
    return _extractor


def get_heuristic_extractor() -> HeuristicMemoryExtractor:
    """获取启发式提取器单例。"""
    global _heuristic_extractor
    if _heuristic_extractor is None:
        _heuristic_extractor = HeuristicMemoryExtractor()
    return _heuristic_extractor
