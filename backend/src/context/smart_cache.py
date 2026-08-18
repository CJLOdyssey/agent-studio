"""Smart caching for LLM responses and intermediate results.

Implements intelligent caching to reduce redundant API calls and
optimize token usage across workflow executions.
"""

import hashlib
import json
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    key: str
    value: Any
    created_at: float
    last_accessed: float
    access_count: int = 0
    ttl: float | None = None  # Time to live in seconds
    size_estimate: int = 0  # Estimated size in tokens

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        if self.ttl is None:
            return False
        return (time.time() - self.created_at) > self.ttl

    def touch(self) -> None:
        """Update access metadata."""
        self.last_accessed = time.time()
        self.access_count += 1


class SmartCache:
    """Intelligent cache with LRU eviction and TTL support.

    Features:
    - LRU (Least Recently Used) eviction policy
    - TTL (Time To Live) for entries
    - Size-based eviction (token-aware)
    - Hit/miss statistics
    - Automatic cleanup of expired entries
    """

    def __init__(
        self,
        max_size: int = 1000,
        max_tokens: int = 100000,
        default_ttl: float | None = 3600.0,
    ):
        """Initialize smart cache.

        Args:
            max_size: Maximum number of entries
            max_tokens: Maximum total tokens in cache
            default_ttl: Default time-to-live in seconds (None = no expiry)
        """
        self.max_size = max_size
        self.max_tokens = max_tokens
        self.default_ttl = default_ttl

        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._current_tokens = 0

        # Statistics
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def _make_key(self, data: Any) -> str:
        """Create cache key from data.

        Args:
            data: Data to create key for

        Returns:
            Hash string as cache key
        """
        if isinstance(data, str):
            key_data = data
        elif isinstance(data, (dict, list)):
            key_data = json.dumps(data, sort_keys=True, ensure_ascii=False)
        else:
            key_data = str(data)

        return hashlib.md5(key_data.encode()).hexdigest()

    def _estimate_tokens(self, value: Any) -> int:
        """Estimate token count for a value.

        Args:
            value: Value to estimate tokens for

        Returns:
            Estimated token count
        """
        if isinstance(value, str):
            # Rough estimate: 4 chars per token
            return max(1, len(value) // 4)
        elif isinstance(value, (dict, list)):
            json_str = json.dumps(value, ensure_ascii=False)
            return max(1, len(json_str) // 4)
        else:
            return 10  # Default estimate

    def get(self, key: str) -> Any | None:
        """Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        if key not in self._cache:
            self.misses += 1
            return None

        entry = self._cache[key]

        # Check expiration
        if entry.is_expired():
            self._remove_entry(key)
            self.misses += 1
            return None

        # Move to end (most recently used)
        self._cache.move_to_end(key)
        entry.touch()
        self.hits += 1

        return entry.value

    def set(
        self,
        key: str,
        value: Any,
        ttl: float | None = None,
    ) -> None:
        """Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (None = use default)
        """
        # Remove existing entry if present
        if key in self._cache:
            self._remove_entry(key)

        # Evict entries if necessary
        token_estimate = self._estimate_tokens(value)
        while len(self._cache) >= self.max_size or (
            self._current_tokens + token_estimate > self.max_tokens
        ):
            if not self._evict_one():
                break

        # Create new entry
        entry = CacheEntry(
            key=key,
            value=value,
            created_at=time.time(),
            last_accessed=time.time(),
            ttl=ttl if ttl is not None else self.default_ttl,
            size_estimate=token_estimate,
        )

        self._cache[key] = entry
        self._current_tokens += token_estimate

    def delete(self, key: str) -> bool:
        """Delete entry from cache.

        Args:
            key: Cache key

        Returns:
            True if entry was deleted, False if not found
        """
        if key not in self._cache:
            return False
        self._remove_entry(key)
        return True

    def _remove_entry(self, key: str) -> None:
        """Remove entry and update token count.

        Args:
            key: Cache key
        """
        if key in self._cache:
            entry = self._cache[key]
            self._current_tokens -= entry.size_estimate
            del self._cache[key]

    def _evict_one(self) -> bool:
        """Evict one entry using LRU policy.

        Returns:
            True if an entry was evicted
        """
        if not self._cache:
            return False

        # Find first non-expired entry (LRU order)
        # OrderedDict maintains insertion order, so first item is least recently used
        key = next(iter(self._cache))
        self._remove_entry(key)
        self.evictions += 1
        return True

    def cleanup_expired(self) -> int:
        """Remove all expired entries.

        Returns:
            Number of entries removed
        """
        expired_keys = [
            key for key, entry in self._cache.items()
            if entry.is_expired()
        ]
        for key in expired_keys:
            self._remove_entry(key)
        return len(expired_keys)

    def clear(self) -> None:
        """Clear all entries from cache."""
        self._cache.clear()
        self._current_tokens = 0

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        total_requests = self.hits + self.misses
        hit_rate = self.hits / total_requests if total_requests > 0 else 0.0

        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "current_tokens": self._current_tokens,
            "max_tokens": self.max_tokens,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate,
            "evictions": self.evictions,
        }

    def get_or_compute(
        self,
        key: str,
        compute_fn: Any,
        ttl: float | None = None,
    ) -> Any:
        """Get value from cache or compute and cache it.

        Args:
            key: Cache key
            compute_fn: Async function to compute value if not cached
            ttl: Time-to-live for computed value

        Returns:
            Cached or computed value
        """
        cached = self.get(key)
        if cached is not None:
            return cached

        # Compute value
        value = compute_fn()
        self.set(key, value, ttl=ttl)
        return value


class ResponseCache:
    """Specialized cache for LLM responses.

    Implements semantic similarity detection to avoid redundant
    API calls for similar prompts.
    """

    def __init__(
        self,
        max_size: int = 500,
        similarity_threshold: float = 0.9,
    ):
        """Initialize response cache.

        Args:
            max_size: Maximum number of cached responses
            similarity_threshold: Threshold for considering prompts similar
        """
        self.cache = SmartCache(max_size=max_size)
        self.similarity_threshold = similarity_threshold
        self._prompt_hashes: dict[str, str] = {}  # hash -> response_key

    def _normalize_prompt(self, prompt: str) -> str:
        """Normalize prompt for comparison.

        Args:
            prompt: Prompt to normalize

        Returns:
            Normalized prompt string
        """
        # Lowercase and strip whitespace
        normalized = prompt.lower().strip()
        # Remove extra whitespace
        normalized = " ".join(normalized.split())
        return normalized

    def _simple_similarity(self, text1: str, text2: str) -> float:
        """Calculate simple similarity between two texts.

        Uses Jaccard similarity on word sets.

        Args:
            text1: First text
            text2: Second text

        Returns:
            Similarity score between 0 and 1
        """
        words1 = set(text1.split())
        words2 = set(text2.split())

        if not words1 or not words2:
            return 0.0

        intersection = words1 & words2
        union = words1 | words2

        return len(intersection) / len(union)

    def get_response(self, prompt: str, model: str = "") -> str | None:
        """Get cached response for a prompt.

        Args:
            prompt: Prompt to look up
            model: Model name (for cache key)

        Returns:
            Cached response or None if not found
        """
        normalized = self._normalize_prompt(prompt)
        cache_key = f"{model}:{hashlib.md5(normalized.encode()).hexdigest()}"

        # Direct match
        response = self.cache.get(cache_key)
        if response is not None:
            logger.debug(f"Cache hit for prompt: {prompt[:50]}...")
            return response

        # Check for similar prompts
        for stored_hash, response_key in self._prompt_hashes.items():
            stored_normalized = self._prompt_hashes.get(stored_hash, "")
            if self._simple_similarity(normalized, stored_normalized) > self.similarity_threshold:
                # Similar prompt found, return cached response
                response = self.cache.get(response_key)
                if response is not None:
                    logger.debug(f"Similar prompt cache hit for: {prompt[:50]}...")
                    return response

        return None

    def cache_response(self, prompt: str, response: str, model: str = "") -> None:
        """Cache a response for a prompt.

        Args:
            prompt: Prompt that generated the response
            response: Response to cache
            model: Model name (for cache key)
        """
        normalized = self._normalize_prompt(prompt)
        cache_key = f"{model}:{hashlib.md5(normalized.encode()).hexdigest()}"

        self.cache.set(cache_key, response)
        self._prompt_hashes[cache_key] = normalized

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        return self.cache.get_stats()


# Global cache instances
_response_cache = ResponseCache()


def get_response_cache() -> ResponseCache:
    """Get global response cache instance."""
    return _response_cache


def clear_all_caches() -> None:
    """Clear all global caches."""
    _response_cache.cache.clear()
