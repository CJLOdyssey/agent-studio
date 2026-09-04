"""_ToolWrapper 的处理器实现——从 tool_config.py 分发。"""

from __future__ import annotations

import asyncio
import json
import shlex
import subprocess
import time
import urllib.request
from typing import TYPE_CHECKING, Any

import httpx
from langchain_core.messages import HumanMessage

from core.infra.logging_config import get_logger

if TYPE_CHECKING:
    from services.tool_config import _ToolWrapper

logger = get_logger(__name__)

def handle_skill(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """返回技能的指令文本作为工具结果。

    未配置的技能（无 instructions）返回清晰提示而非空结果，使模型不会
    误读为「无事可做」。
    """
    if tool_self.instructions:
        return tool_self.instructions
    return json.dumps({
        "role": "skill",
        "name": tool_self.name,
        "status": "unconfigured",
        "content": (
            f"技能 {tool_self.name} 未配置使用说明（instructions 为空）。"
            "请在技能管理中填写 instructions 后再调用此技能。"
        ),
    }, ensure_ascii=False)


async def handle_mcp(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """分发 MCP 工具调用。"""
    return await execute_mcp(tool_self, args)


async def call_http_endpoint(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """使用工具配置的方法与请求头调用 HTTP 端点。

    端点可包含 ``{param}`` 占位符（RFC 6570 URI 模板）——匹配的键从 *args*
    取出并替换进路径；其余参数作为查询参数（GET）或 JSON body（其他方法）
    发送。
    """
    try:
        hdrs = json.loads(tool_self.headers) if isinstance(tool_self.headers, str) else {}
        hdrs.setdefault("Content-Type", "application/json")

        url = tool_self.endpoint
        query_args: dict[str, Any] = dict(args)
        if "{" in url:
            path_args, query_args = {}, dict(args)
            for key, value in list(query_args.items()):
                token = "{" + str(key) + "}"
                if token in url:
                    url = url.replace(token, str(value))
                    path_args[key] = value
            query_args = {k: v for k, v in query_args.items() if k not in path_args}

        async with httpx.AsyncClient(timeout=30.0) as client:
            if tool_self.method.upper() == "GET":
                resp = await client.get(url, params=query_args, headers=hdrs)
            else:
                resp = await client.post(url, json=query_args, headers=hdrs)
            resp.raise_for_status()
            return resp.text
    except httpx.HTTPStatusError as e:
        return json.dumps({"tool": tool_self.name, "error": f"HTTP {e.response.status_code}: {e.response.text[:500]}"})
    except Exception as e:
        return json.dumps({"tool": tool_self.name, "error": str(e)})


async def execute_mcp(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """MCP 执行：sse → httpx，stdio → mcp SDK，回退 → execute_tool。"""
    if tool_self.mcp_type == "sse" and tool_self.mcp_endpoint:
        try:
            params = {"name": tool_self.mcp_tool_name or tool_self.name, "arguments": args}
            body = json.dumps({"jsonrpc": "2.0", "method": "tools/call", "params": params, "id": 1})
            async with httpx.AsyncClient(timeout=30) as client:
                hdrs = {"Content-Type": "application/json"}
                resp = await client.post(tool_self.mcp_endpoint, content=body, headers=hdrs)
                return resp.text[:5000]
        except Exception as e:
            return json.dumps({"error": str(e)})

    if tool_self.mcp_type == "stdio" and tool_self.mcp_endpoint:
        return await call_mcp_sdk(tool_self, args)

    result = execute_tool(tool_self, args)
    logger.debug("MCP fallback to tool execution | tool=%s", tool_self.name)
    return result


def execute_tool(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """执行工具：HTTP POST 或本地命令。"""
    if tool_self.mcp_endpoint:
        if tool_self.mcp_endpoint.startswith("http://") or tool_self.mcp_endpoint.startswith("https://"):
            try:
                body = json.dumps(args).encode()
                req = urllib.request.Request(
                    tool_self.mcp_endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST"
                )
                with urllib.request.urlopen(req, timeout=30) as resp:  # nosec B310
                    data: bytes = resp.read()
                    return data.decode("utf-8", errors="ignore")[:5000]
            except Exception as e:
                return json.dumps({"error": str(e)})
        else:
            try:
                cmd = [tool_self.mcp_endpoint] + [str(v) for v in args.values()]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                stdout = result.stdout[:3000]
                stderr = result.stderr[:500]
                return json.dumps({"stdout": stdout, "stderr": stderr, "rc": result.returncode})
            except subprocess.TimeoutExpired:
                return json.dumps({"error": "timeout (30s)"})
            except Exception as e:
                return json.dumps({"error": str(e)})
    return json.dumps({"status": "called", "args": args})


def _normalize_mcp_env(env: Any) -> dict[str, str] | None:
    """为 ``StdioServerParameters`` 规范化 MCP env 配置（字典或 ``K=V`` 字符串列表）。"""
    if not env:
        return None
    if isinstance(env, dict):
        return {str(k): str(v) for k, v in env.items()}
    if isinstance(env, (list, tuple)):
        out: dict[str, str] = {}
        for item in env:
            if isinstance(item, str) and "=" in item:
                key, _, value = item.partition("=")
                out[key.strip()] = value
        return out or None
    return None


def _mcp_params(tool_self: _ToolWrapper) -> Any:
    """从 ``tool_self.mcp_config`` 构建 ``StdioServerParameters``。

    对在端点字符串内联参数的旧式工具定义，回退到
    ``shlex.split(tool_self.mcp_endpoint)``。
    """
    from mcp import StdioServerParameters

    cfg = tool_self.mcp_config or {}
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except Exception:
            cfg = {}
    if not isinstance(cfg, dict):
        cfg = {}
    cmd = cfg.get("command") or tool_self.mcp_endpoint
    args = cfg.get("args") or []
    env = _normalize_mcp_env(cfg.get("env"))
    if args:
        return StdioServerParameters(command=str(cmd), args=[str(a) for a in args], env=env)
    cmd_parts = shlex.split(cmd)
    return StdioServerParameters(command=cmd_parts[0], args=cmd_parts[1:], env=env)


async def call_mcp_sdk(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """调用 MCP stdio 工具，按 run_id 缓存会话以保持浏览器状态。"""
    from mcp.client.session import ClientSession
    from mcp.client.stdio import stdio_client

    async def _call(session: Any, name: str | None, arguments: dict[str, Any] | None, timeout: int = 45) -> Any:
        if name:
            return await asyncio.wait_for(session.call_tool(name, arguments=arguments or {}), timeout=timeout)
        return await asyncio.wait_for(session.list_tools(), timeout=20)

    # 发现调用（无特定工具名）始终创建全新连接
    if not tool_self.mcp_tool_name:
        params = _mcp_params(tool_self)
        try:
            async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
                await session.initialize()
                result = await _call(session, None, None)
        except Exception as e:
            return json.dumps({"error": str(e)})
        tools = getattr(result, "tools", [])
        if tools:
            lines = []
            for t in tools:
                props: dict[str, Any] = {}
                if hasattr(t, "inputSchema") and t.inputSchema:
                    props = t.inputSchema.get("properties", {}) or {}
                desc = "; ".join(f"{k}: {v.get('description','')}" for k, v in props.items()) if props else ""
                lines.append(f"- {t.name}: {t.description or ''} [{desc}]")
            return ("MCP server provides:\n" + "\n".join(lines) +
                    "\n\nTo call one, pass {\"_tool\": \"TOOL_NAME\", \"_args\": {...}}")
        return json.dumps({"error": "no tools found"})

    params = _mcp_params(tool_self)
    run_key = tool_self._run_id or ""

    # 每次调用都创建全新会话。我们有意不跨调用缓存会话：stdio_client/
    # ClientSession 使用的 anyio cancel scope 是任务作用域的，从不同任务
    # 重新进入/退出会抛出 "Attempted to exit cancel scope in a different task"。
    # 全新的 `async with` 使进入/退出保持在同一任务内，因而安全。
    try:
        async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
            await session.initialize()
            result = await _call(session, tool_self.mcp_tool_name, args)
            if tool_self.name and "browser_" in tool_self.name and tool_self._run_id:
                await _push_mcp_screenshot(session, tool_self._run_id)
            texts = _extract_mcp_texts(result)
            return texts if texts else json.dumps({"result": "ok"})
    except asyncio.CancelledError:
        # 不要让 CancelledError 逃逸到图：agent_pipeline 用 asyncio.timeout
        # 包裹 graph.run，其 cancel scope 在 spawn MCP stdio 子进程时可能与
        # anyio 的内部 scope 冲突。吞掉它并返回错误字符串，使 run 能收敛
        # 而非崩溃。
        logger.warning("MCP call cancelled (run=%s tool=%s) — suppressing", run_key[:12], tool_self.name)
        return json.dumps({"tool": tool_self.name, "error": "MCP 调用被中断（子进程启动超时或取消）"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def _extract_mcp_texts(result: Any) -> str:
    """从 MCP 工具结果中提取文本内容。"""
    content_list = getattr(result, "content", [])
    texts = [getattr(c, "text", "") for c in content_list if getattr(c, "text", "")]
    texts = [t for t in texts if t]
    return "\n".join(texts) if texts else ""


async def _push_mcp_screenshot(session: Any, run_id: str | None) -> None:
    """浏览器工具调用后截图，并通过 WebSocket 推送到前端。"""
    if not run_id:
        return
    try:
        r = await session.call_tool("browser_take_screenshot", {"type": "png"})
        for c in (r.content or []):
            if hasattr(c, "type") and c.type == "image" and hasattr(c, "data") and c.data:
                from broker import publish_run_message
                await publish_run_message(run_id, {"type": "browser_frame", "data": c.data})
                return
    except Exception:
        pass


async def llm_fallback(tool_self: _ToolWrapper, args: dict[str, Any]) -> str:
    """无其他处理器匹配时，用 LLM 作为回退执行器。"""
    if tool_self._llm:
        try:
            prompt = (
                f"You are the '{tool_self.name}' tool. "
                f"Your description: {tool_self.description or 'No description'}.\n"
                "Execute this tool call and return ONLY the result "
                "as plain text or JSON (no markdown, no explanation):\n"
                f"Arguments: {json.dumps(args, ensure_ascii=False)}\n"
                "Output:"
            )
            t0 = time.time()
            resp = await tool_self._llm.ainvoke([HumanMessage(content=prompt)])
            elapsed = time.time() - t0
            logger.info(
                "LLM tool-fallback | tool=%s | model=%s | elapsed=%.2fs | out=%d chars",
                tool_self.name, getattr(tool_self._llm, 'model', '?'), elapsed, len(resp.content or ""),
            )
            return resp.content
        except Exception as e:
            return json.dumps({"tool": tool_self.name, "status": "error", "error": str(e)})
    note = "no LLM available, falling back"
    return json.dumps({"tool": tool_self.name, "status": "executed", "note": note, "args": args})
