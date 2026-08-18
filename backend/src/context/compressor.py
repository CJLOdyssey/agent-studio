"""Context compression for managing token usage in multi-agent workflows.

Implements intelligent context compression to reduce token consumption
while preserving essential information for decision making.
"""

import hashlib
from dataclasses import dataclass
from enum import Enum
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


class CompressionStrategy(Enum):
    """Strategies for compressing context."""
    SUMMARY = "summary"          # Summarize long content
    TRUNCATE = "truncate"        # Truncate to max length
    DEDUPLICATE = "deduplicate"  # Remove duplicate content
    EXTRACT_KEY = "extract_key"  # Extract key information
    CHUNK = "chunk"              # Split into smaller chunks


@dataclass
class CompressionResult:
    """Result of context compression."""
    compressed_content: str
    original_tokens: int
    compressed_tokens: int
    compression_ratio: float
    strategy_used: CompressionStrategy
    metadata: dict[str, Any] | None = None


class ContextCompressor:
    """Compresses context to reduce token usage while preserving key information.

    Implements multiple compression strategies:
    - Summary: Uses LLM to summarize long content
    - Truncate: Cuts content to max length
    - Deduplicate: Removes duplicate messages/content
    - Extract Key: Extracts key information using NLP
    - Chunk: Splits large content into manageable pieces
    """

    def __init__(
        self,
        max_tokens: int = 4000,
        target_compression_ratio: float = 0.5,
        enable_deduplication: bool = True,
        enable_summarization: bool = True,
    ):
        """Initialize context compressor.

        Args:
            max_tokens: Maximum tokens allowed after compression
            target_compression_ratio: Target ratio of compressed/original tokens
            enable_deduplication: Whether to remove duplicate content
            enable_summarization: Whether to use LLM summarization
        """
        self.max_tokens = max_tokens
        self.target_compression_ratio = target_compression_ratio
        self.enable_deduplication = enable_deduplication
        self.enable_summarization = enable_summarization
        self._content_hashes: dict[str, int] = {}

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text.

        Uses simple heuristic: ~4 characters per token for English,
        ~2 characters per token for Chinese.

        Args:
            text: Text to estimate tokens for

        Returns:
            Estimated token count
        """
        if not text:
            return 0

        # Count Chinese characters (roughly 2 chars per token)
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars

        # Estimate: Chinese ~1.5 chars/token, English ~4 chars/token
        estimated_tokens = int(chinese_chars / 1.5 + other_chars / 4)
        return max(1, estimated_tokens)

    def deduplicate_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Remove duplicate messages from conversation history.

        Args:
            messages: List of message dictionaries

        Returns:
            Deduplicated message list
        """
        if not self.enable_deduplication:
            return messages

        seen_hashes = set()
        deduplicated = []

        for msg in messages:
            # Create hash of message content
            content = msg.get("content", "")
            role = msg.get("role", "")
            msg_hash = hashlib.md5(f"{role}:{content}".encode()).hexdigest()

            if msg_hash not in seen_hashes:
                seen_hashes.add(msg_hash)
                deduplicated.append(msg)
            else:
                logger.debug(f"Removed duplicate message: {role}")

        return deduplicated

    def truncate_content(self, content: str, max_length: int = 1000) -> str:
        """Truncate content to maximum length.

        Args:
            content: Content to truncate
            max_length: Maximum character length

        Returns:
            Truncated content with ellipsis if needed
        """
        if len(content) <= max_length:
            return content

        # Keep beginning and end, truncate middle
        keep_chars = max_length // 2
        truncated = content[:keep_chars] + "\n...[truncated]...\n" + content[-keep_chars:]
        return truncated

    def extract_key_sentences(self, text: str, max_sentences: int = 5) -> list[str]:
        """Extract key sentences from text using simple heuristics.

        Prioritizes sentences with:
        - Numbers and statistics
        - Key terms (important, critical, must, should)
        - Short, concise statements

        Args:
            text: Text to extract from
            max_sentences: Maximum sentences to extract

        Returns:
            List of key sentences
        """
        if not text:
            return []

        # Split into sentences
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

        # Score sentences by importance
        scored = []
        key_terms = ["important", "critical", "must", "should", "key", "main", "重要", "关键", "必须", "应该"]

        for sent in sentences:
            score = 0
            # Boost for key terms
            for term in key_terms:
                if term in sent.lower():
                    score += 2
            # Boost for numbers
            if any(c.isdigit() for c in sent):
                score += 1
            # Boost for shorter sentences (more concise)
            if len(sent) < 100:
                score += 1
            # Penalize very long sentences
            if len(sent) > 200:
                score -= 1

            scored.append((score, sent))

        # Sort by score and return top sentences
        scored.sort(reverse=True, key=lambda x: x[0])
        return [sent for _, sent in scored[:max_sentences]]

    async def compress(
        self,
        content: str | list[dict[str, Any]],
        strategy: CompressionStrategy = CompressionStrategy.TRUNCATE,
        llm: Any | None = None,
    ) -> CompressionResult:
        """Compress content using specified strategy.

        Args:
            content: Content to compress (string or message list)
            strategy: Compression strategy to use
            llm: Optional LLM for summarization

        Returns:
            CompressionResult with compressed content and metadata
        """
        # Handle message lists
        if isinstance(content, list):
            # Deduplicate messages first
            if self.enable_deduplication:
                content = self.deduplicate_messages(content)
            # Convert to string for compression
            content_str = "\n".join(
                f"{msg.get('role', 'unknown')}: {msg.get('content', '')}"
                for msg in content
            )
        else:
            content_str = content

        original_tokens = self.estimate_tokens(content_str)

        # Apply compression strategy
        compressed = content_str
        metadata = {}

        if strategy == CompressionStrategy.TRUNCATE:
            # Truncate to max tokens (roughly 4 chars per token)
            max_chars = self.max_tokens * 4
            compressed = self.truncate_content(content_str, max_chars)

        elif strategy == CompressionStrategy.DEDUPLICATE:
            # Already deduplicated if it was a message list
            if isinstance(content, list) and self.enable_deduplication:
                compressed = content_str
            else:
                # For strings, remove duplicate lines
                lines = content_str.split("\n")
                seen = set()
                unique_lines = []
                for line in lines:
                    if line not in seen:
                        seen.add(line)
                        unique_lines.append(line)
                compressed = "\n".join(unique_lines)

        elif strategy == CompressionStrategy.EXTRACT_KEY:
            # Extract key sentences
            key_sentences = self.extract_key_sentences(content_str, max_sentences=10)
            compressed = "\n".join(key_sentences)
            metadata["extracted_sentences"] = len(key_sentences)

        elif strategy == CompressionStrategy.SUMMARY:
            if self.enable_summarization and llm:
                # Use LLM to summarize
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
                    # Fallback to truncation
                    compressed = self.truncate_content(content_str, self.max_tokens * 4)
                    metadata["summarized"] = False
            else:
                # Fallback to truncation
                compressed = self.truncate_content(content_str, self.max_tokens * 4)
                metadata["summarized"] = False

        elif strategy == CompressionStrategy.CHUNK:
            # Split into chunks, keep first and last
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
        """Split text into chunks of approximately equal size.

        Args:
            text: Text to split
            chunk_size: Target chunk size in characters

        Returns:
            List of text chunks
        """
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            # Try to break at sentence boundary
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
        """Compress workflow state to fit within token budget.

        Prioritizes compression of:
        1. Long message histories
        2. Large context strings
        3. Verbose metadata

        Args:
            state: Workflow state dictionary
            max_total_tokens: Maximum total tokens for entire state

        Returns:
            Compressed state dictionary
        """
        compressed_state = state.copy()

        # Compress messages list
        if "messages" in compressed_state:
            messages = compressed_state["messages"]
            if isinstance(messages, list) and len(messages) > 10:
                # Keep system message and last N messages
                system_msgs = [m for m in messages if m.get("role") == "system"]
                other_msgs = [m for m in messages if m.get("role") != "system"]

                # Keep last 10 messages, compress older ones
                if len(other_msgs) > 10:
                    old_msgs = other_msgs[:-10]
                    recent_msgs = other_msgs[-10:]

                    # Compress old messages
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

        # Compress large context strings
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
