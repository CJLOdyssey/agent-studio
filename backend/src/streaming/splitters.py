"""SSE 流式思维链解析器 —— 将 ``<think>`` 标签跨 chunk 拆分到 thinking/content 通道。"""


class ThinkTagSplitter:
    """为在 <think> 标签内输出思维链的模型服务的流式拆分器。

    部分供应商（如 SiliconFlow 的 GLM-Z1）把推理过程以内联方式放在
    ``content`` 中并用 ``<think>...</think>`` 包裹，而非通过
    ``reasoning_content`` 输出。该状态机会跨 SSE chunk 累积这些标签，
    将包裹文本路由到 "thinking"、其余路由到 "content"，使 UI 能单独渲染思维链。
    """

    __slots__ = ("_in_think", "_buffer")

    def __init__(self) -> None:
        self._in_think = False
        self._buffer: list[str] = []

    def feed(self, text: str) -> tuple[list[str], list[str]]:
        """处理一个内容 chunk；返回 (thinking_parts, content_parts)。"""
        thinking: list[str] = []
        content: list[str] = []
        rest = text
        while rest:
            tag = "</think>" if self._in_think else "<think>"
            idx = rest.find(tag)
            if idx < 0:
                if self._in_think:
                    self._buffer.append(rest)
                else:
                    content.append(rest)
                break
            head, tail = rest[:idx], rest[idx + len(tag):]
            if self._in_think:
                self._buffer.append(head)
                thinking.append("".join(self._buffer))
                self._buffer = []
                self._in_think = False
            else:
                if head:
                    content.append(head)
                self._in_think = True
            rest = tail
        return thinking, content

    def finish(self) -> tuple[str | None, str | None]:
        """冲刷尾部缓冲。返回 (leftover_thinking, leftover_content)。"""
        leftover = "".join(self._buffer)
        self._buffer = []
        if leftover:
            if self._in_think:
                self._in_think = False
                return leftover, None
            return None, leftover
        return None, None


class ReasoningSplitter:
    """为可能携带 <think> 标签的 ``reasoning_content`` 服务的流式拆分器。

    SiliconFlow 的 GLM-Z1 在 ``reasoning_content`` 中输出被 ``<think>`` 包裹的
    思维链——标签可能被 SSE chunk 切开（``'<th'`` + ``'ink'`` + ``'>'``），
    且闭合标签常被完全省略。DeepSeek 原生的 ``reasoning_content`` 则完全不带标签。

    两种模式的状态机：
    - content 模式：有界等待完整拼出的 ``<think>`` 起始标签（跨 chunk 切分）；
      超过小字符预算后视为无标签流（DeepSeek）并立即输出。
    - thinking 模式：剥离完整拼出的 ``</think>`` 闭合标签（跨 chunk 切分）
      并输出其之前的所有内容；剩余部分重新处理（可能开启新的 think 块）。
    """

    __slots__ = ("_pending", "_in_think")

    _OPEN_TAG = "<think>"
    _CLOSE_TAG = "</think>"
    # 有界等待标签跨 chunk 拼出：<think> 共 7 字符，供应商约每 chunk 切 1-2 字符，
    # 故 16 字符可覆盖最坏情况，同时保证无标签流（DeepSeek）仍实时输出。
    _TAG_WAIT_CHARS = 16

    def __init__(self) -> None:
        self._pending: list[str] = []
        self._in_think = False

    def feed(self, text: str) -> list[str]:
        """处理一个 reasoning chunk；返回要输出的 thinking 片段。"""
        out: list[str] = []
        rest = text
        while rest:
            rest = (
                self._feed_thinking(rest, out)
                if self._in_think
                else self._feed_content(rest, out)
            )
        return out

    def _feed_content(self, text: str, out: list[str]) -> str:
        """content 模式：等待起始标签，或直接流式输出无标签输入。"""
        self._pending.append(text)
        joined = "".join(self._pending)
        idx = joined.find(self._OPEN_TAG)
        if idx < 0:
            if len(joined) >= self._TAG_WAIT_CHARS:
                flushed = "".join(self._pending)
                self._pending = []
                if flushed:
                    out.append(flushed)
            return ""
        # 起始标签已拼出——丢弃其之前的所有内容（如前置换行等格式噪声）
        # 并切换到 thinking 模式。尾部也可能以 chunk 边界的换行开头；一并剥离。
        tail = joined[idx + len(self._OPEN_TAG):].lstrip("\n")
        self._pending = []
        self._in_think = True
        return tail

    def _feed_thinking(self, text: str, out: list[str]) -> str:
        """thinking 模式：剥离闭合标签（跨 chunk），保留其余内容。"""
        self._pending.append(text)
        joined = "".join(self._pending)
        idx = joined.find(self._CLOSE_TAG)
        if idx < 0:
            # 尚未闭合——输出除尾部片段外的所有内容，尾部可能是被切开的闭合标签。
            hold = len(self._CLOSE_TAG) - 1
            if len(joined) > hold:
                emit, keep = joined[:-hold], joined[-hold:]
                self._pending = [keep]
                if emit:
                    out.append(emit)
            return ""
        before = joined[:idx]
        self._pending = []
        self._in_think = False
        if before:
            out.append(before)
        return joined[idx + len(self._CLOSE_TAG):]

    def finish(self) -> str | None:
        """冲刷剩余缓冲的思考文本。"""
        leftover = "".join(self._pending)
        self._pending = []
        self._in_think = False
        return leftover or None
