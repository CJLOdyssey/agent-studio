"""多智能体工作流中用于管理 token 用量的上下文压缩。

实现智能上下文压缩，在保留决策所需关键信息的同时减少 token 消耗。
"""

import hashlib
from dataclasses import dataclass
from enum import Enum
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


class CompressionStrategy(Enum):
    """上下文压缩策略。"""
    SUMMARY = "summary"          # 摘要长内容
    TRUNCATE = "truncate"        # 截断到最大长度
    DEDUPLICATE = "deduplicate"  # 去重内容
    EXTRACT_KEY = "extract_key"  # 提取关键信息
    CHUNK = "chunk"              # 切分为更小块


@dataclass
class CompressionResult:
    """上下文压缩的结果。"""
    compressed_content: str
    original_tokens: int
    compressed_tokens: int
    compression_ratio: float
    strategy_used: CompressionStrategy
    metadata: dict[str, Any] | None = None


class ContextCompressor:
    """压缩上下文以减少 token 用量并保留关键信息。

    实现多种压缩策略：
    - Summary: 用 LLM 摘要长内容
    - Truncate: 将内容截断到最大长度
    - Deduplicate: 去重消息/内容
    - Extract Key: 用 NLP 提取关键信息
    - Chunk: 将大内容拆分为可管理的小块
    """

    def __init__(
        self,
        max_tokens: int = 4000,
        target_compression_ratio: float = 0.5,
        enable_deduplication: bool = True,
        enable_summarization: bool = True,
    ):
        """初始化上下文压缩器。

        参数：
            max_tokens: 压缩后允许的最大 tokens
            target_compression_ratio: 压缩后/原始 tokens 的目标比例
            enable_deduplication: 是否去重内容
            enable_summarization: 是否使用 LLM 摘要
        """
        self.max_tokens = max_tokens
        self.target_compression_ratio = target_compression_ratio
        self.enable_deduplication = enable_deduplication
        self.enable_summarization = enable_summarization
        self._content_hashes: dict[str, int] = {}

    def estimate_tokens(self, text: str) -> int:
        """估算文本的 token 数。

        采用简单启发式：英文约每 token 4 字符，中文约每 token 2 字符。

        参数：
            text: 要估算 tokens 的文本

        返回：
            估算的 token 数
        """
        if not text:
            return 0

        # 统计中文字符（约 2 字符每 token）
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars

        # 估算：中文约 1.5 字符/token，英文约 4 字符/token
        estimated_tokens = int(chinese_chars / 1.5 + other_chars / 4)
        return max(1, estimated_tokens)

    def deduplicate_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """从对话历史中去重消息。

        参数：
            messages: 消息字典列表

        返回：
            去重后的消息列表
        """
        if not self.enable_deduplication:
            return messages

        seen_hashes = set()
        deduplicated = []

        for msg in messages:
            # 计算消息内容的哈希
            content = msg.get("content", "")
            role = msg.get("role", "")
            msg_hash = hashlib.md5(f"{role}:{content}".encode(), usedforsecurity=False).hexdigest()

            if msg_hash not in seen_hashes:
                seen_hashes.add(msg_hash)
                deduplicated.append(msg)
            else:
                logger.debug(f"Removed duplicate message: {role}")

        return deduplicated

    def truncate_content(self, content: str, max_length: int = 1000) -> str:
        """将内容截断到最大长度。

        参数：
            content: 要截断的内容
            max_length: 最大字符长度

        返回：
            必要时带省略号的截断内容
        """
        if len(content) <= max_length:
            return content

        # 保留开头和结尾，截断中间
        keep_chars = max_length // 2
        truncated = content[:keep_chars] + "\n...[truncated]...\n" + content[-keep_chars:]
        return truncated

    def extract_key_sentences(self, text: str, max_sentences: int = 5) -> list[str]:
        """用简单启发式从文本中提取关键句。

        优先选取包含以下内容的句子：
        - 数字与统计
        - 关键词（important, critical, must, should）
        - 简短精炼的陈述

        参数：
            text: 要提取的文本
            max_sentences: 最多提取的句子数

        返回：
            关键句列表
        """
        if not text:
            return []

        # 切分为句子
        sentences = []
        current = []
        for char in text:
            current.append(char)
            if char in ".!?。！？":
                sentence = "".join(current).strip()
                if sentence:
                    sentences.append(sentence)
                current = []

        if current:
            sentence = "".join(current).strip()
            if sentence:
                sentences.append(sentence)

        # 按重要性给句子打分
        scored = []
        key_terms = ["important", "critical", "must", "should", "key", "main", "重要", "关键", "必须", "应该"]

        for sent in sentences:
            score = 0
            # 命中关键词加分
            for term in key_terms:
                if term in sent.lower():
                    score += 2
            # 含数字加分
            if any(c.isdigit() for c in sent):
                score += 1
            # 较短句子（更精炼）加分
            if len(sent) < 100:
                score += 1
            # 过长句子减分
            if len(sent) > 200:
                score -= 1

            scored.append((score, sent))

        # 按分数排序并返回前若干个句子
        scored.sort(reverse=True, key=lambda x: x[0])
        return [sent for _, sent in scored[:max_sentences]]

    async def compress(
        self,
        content: str | list[dict[str, Any]],
        strategy: CompressionStrategy = CompressionStrategy.TRUNCATE,
        llm: Any | None = None,
    ) -> CompressionResult:
        """按指定策略压缩内容。

        参数：
            content: 要压缩的内容（字符串或消息列表）
            strategy: 使用的压缩策略
            llm: 用于摘要的可选 LLM

        返回：
            带压缩内容与元数据的 CompressionResult
        """
        # 处理消息列表
        if isinstance(content, list):
            # 先去重消息
            if self.enable_deduplication:
                content = self.deduplicate_messages(content)
            # 转为字符串以压缩
            content_str = "\n".join(
                f"{msg.get('role', 'unknown')}: {msg.get('content', '')}"
                for msg in content
            )
        else:
            content_str = content

        original_tokens = self.estimate_tokens(content_str)

        # 应用压缩策略
        compressed = content_str
        metadata = {}

        if strategy == CompressionStrategy.TRUNCATE:
            # 截断到最大 tokens（约每 token 4 字符）
            max_chars = self.max_tokens * 4
            compressed = self.truncate_content(content_str, max_chars)

        elif strategy == CompressionStrategy.DEDUPLICATE:
            # 若原本是消息列表则已完成去重
            if isinstance(content, list) and self.enable_deduplication:
                compressed = content_str
            else:
                # 字符串则去除重复行
                lines = content_str.split("\n")
                seen = set()
                unique_lines = []
                for line in lines:
                    if line not in seen:
                        seen.add(line)
                        unique_lines.append(line)
                compressed = "\n".join(unique_lines)

        elif strategy == CompressionStrategy.EXTRACT_KEY:
            # 提取关键句
            key_sentences = self.extract_key_sentences(content_str, max_sentences=10)
            compressed = "\n".join(key_sentences)
            metadata["extracted_sentences"] = len(key_sentences)

        elif strategy == CompressionStrategy.SUMMARY:
            if self.enable_summarization and llm:
                # 用 LLM 摘要
                try:
                    truncated = content_str[:8000]
                    summary_prompt = (
                        "Summarize the following content concisely, "
                        f"preserving key information:\n\n{truncated}"
                    )
                    response = await llm.ainvoke([{"role": "user", "content": summary_prompt}])
                    compressed = response.content if hasattr(response, "content") else str(response)
                    metadata["summarized"] = True
                except Exception as e:
                    logger.error(f"Summarization failed: {e}")
                    # 回退到截断
                    compressed = self.truncate_content(content_str, self.max_tokens * 4)
                    metadata["summarized"] = False
            else:
                # 回退到截断
                compressed = self.truncate_content(content_str, self.max_tokens * 4)
                metadata["summarized"] = False

        elif strategy == CompressionStrategy.CHUNK:
            # 切分为块，保留首尾
            chunks = self._split_into_chunks(content_str, chunk_size=self.max_tokens * 2)
            if len(chunks) > 2:
                compressed = chunks[0] + "\n...[middle chunks omitted]...\n" + chunks[-1]
                metadata["total_chunks"] = len(chunks)
                metadata["kept_chunks"] = 2
            else:
                compressed = content_str

        compressed_tokens = self.estimate_tokens(compressed)
        compression_ratio = compressed_tokens / original_tokens if original_tokens > 0 else 1.0

        return CompressionResult(
            compressed_content=compressed,
            original_tokens=original_tokens,
            compressed_tokens=compressed_tokens,
            compression_ratio=compression_ratio,
            strategy_used=strategy,
            metadata=metadata,
        )

    def _split_into_chunks(self, text: str, chunk_size: int) -> list[str]:
        """将文本切分为近似等大的块。

        参数：
            text: 要切分的文本
            chunk_size: 目标块大小（字符）

        返回：
            文本块列表
        """
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            # 尽量在句子边界处断开
            if end < len(text):
                for sep in [".\n", "。\n", "\n\n", ". ", "。 "]:
                    last_sep = text[start:end].rfind(sep)
                    if last_sep > chunk_size // 2:
                        end = start + last_sep + len(sep)
                        break

            chunks.append(text[start:end])
            start = end

        return chunks

    async def compress_workflow_state(
        self,
        state: dict[str, Any],
        max_total_tokens: int = 8000,
    ) -> dict[str, Any]:
        """压缩工作流状态以适配 token 预算。

        优先压缩：
        1. 较长的消息历史
        2. 较大的上下文字符串
        3. 冗长的元数据

        参数：
            state: 工作流状态字典
            max_total_tokens: 整个状态的最大 tokens

        返回：
            压缩后的状态字典
        """
        compressed_state = state.copy()

        # 压缩消息列表
        if "messages" in compressed_state:
            messages = compressed_state["messages"]
            if isinstance(messages, list) and len(messages) > 10:
                # 保留 system 消息与最近 N 条
                system_msgs = [m for m in messages if m.get("role") == "system"]
                other_msgs = [m for m in messages if m.get("role") != "system"]

                # 保留最近 10 条，压缩更早的
                if len(other_msgs) > 10:
                    old_msgs = other_msgs[:-10]
                    recent_msgs = other_msgs[-10:]

                    # 压缩旧消息
                    old_content = "\n".join(
                        f"{m.get('role', 'unknown')}: {m.get('content', '')}"
                        for m in old_msgs
                    )
                    result = await self.compress(
                        old_content,
                        strategy=CompressionStrategy.SUMMARY,
                    )

                    summary_msg = {
                        "role": "system",
                        "content": f"[Previous conversation summary]: {result.compressed_content}",
                    }
                    compressed_state["messages"] = system_msgs + [summary_msg] + recent_msgs

        # 压缩较大的上下文字符串
        for key in ["context", "attachment_context", "requirement"]:
            if key in compressed_state:
                content = compressed_state[key]
                if isinstance(content, str) and self.estimate_tokens(content) > 2000:
                    result = await self.compress(
                        content,
                        strategy=CompressionStrategy.TRUNCATE,
                    )
                    compressed_state[key] = result.compressed_content

        return compressed_state
