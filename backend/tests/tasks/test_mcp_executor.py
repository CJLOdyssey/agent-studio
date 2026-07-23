"""Tests for backend.tasks.mcp_executor — exec_stdio_mcp."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestExecStdioMcp:

    @patch("mcp.client.stdio.stdio_client")
    @patch("mcp.client.session.ClientSession")
    @patch("mcp.StdioServerParameters")
    async def test_success(self, mock_params, mock_session_cls, mock_stdio):
        mock_params.return_value = MagicMock()

        mock_read = MagicMock()
        mock_write = MagicMock()
        stdio_cm = AsyncMock()
        stdio_cm.__aenter__ = AsyncMock(return_value=(mock_read, mock_write))
        stdio_cm.__aexit__ = AsyncMock(return_value=False)
        mock_stdio.return_value = stdio_cm

        session = AsyncMock()
        result_mock = MagicMock()
        result_mock.isError = False
        content_item = MagicMock()
        content_item.text = "output text"
        result_mock.content = [content_item]
        session.call_tool = AsyncMock(return_value=result_mock)
        session.initialize = AsyncMock()

        session_cm = AsyncMock()
        session_cm.__aenter__ = AsyncMock(return_value=session)
        session_cm.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = session_cm

        tc = MagicMock()
        tc.endpoint = "node server.js"
        tc.name = "read_file"

        with patch("backend.tasks.mcp_executor.asyncio") as mock_asyncio:
            mock_asyncio.timeout = MagicMock()
            mock_asyncio.timeout.__aenter__ = AsyncMock()
            mock_asyncio.timeout.__aexit__ = AsyncMock(return_value=False)
            from backend.tasks.mcp_executor import exec_stdio_mcp
            result = await exec_stdio_mcp(tc, '{"path": "/tmp"}')

        assert result == "output text"

    @patch("mcp.client.stdio.stdio_client")
    @patch("mcp.client.session.ClientSession")
    @patch("mcp.StdioServerParameters")
    async def test_error_result(self, mock_params, mock_session_cls, mock_stdio):
        mock_params.return_value = MagicMock()

        stdio_cm = AsyncMock()
        stdio_cm.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
        stdio_cm.__aexit__ = AsyncMock(return_value=False)
        mock_stdio.return_value = stdio_cm

        session = AsyncMock()
        result_mock = MagicMock()
        result_mock.isError = True
        content_item = MagicMock()
        content_item.text = "something went wrong"
        result_mock.content = [content_item]
        session.call_tool = AsyncMock(return_value=result_mock)
        session.initialize = AsyncMock()

        session_cm = AsyncMock()
        session_cm.__aenter__ = AsyncMock(return_value=session)
        session_cm.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = session_cm

        tc = MagicMock()
        tc.endpoint = "cmd"
        tc.name = "tool1"

        with patch("backend.tasks.mcp_executor.asyncio") as mock_asyncio:
            mock_asyncio.timeout = MagicMock()
            mock_asyncio.timeout.__aenter__ = AsyncMock()
            mock_asyncio.timeout.__aexit__ = AsyncMock(return_value=False)
            from backend.tasks.mcp_executor import exec_stdio_mcp
            result = await exec_stdio_mcp(tc, "args")

        assert "[MCP Error]" in result
        assert "something went wrong" in result

    @patch("mcp.client.stdio.stdio_client")
    @patch("mcp.client.session.ClientSession")
    @patch("mcp.StdioServerParameters")
    async def test_error_result_no_content(self, mock_params, mock_session_cls, mock_stdio):
        mock_params.return_value = MagicMock()

        stdio_cm = AsyncMock()
        stdio_cm.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
        stdio_cm.__aexit__ = AsyncMock(return_value=False)
        mock_stdio.return_value = stdio_cm

        session = AsyncMock()
        result_mock = MagicMock()
        result_mock.isError = True
        result_mock.content = []
        session.call_tool = AsyncMock(return_value=result_mock)
        session.initialize = AsyncMock()

        session_cm = AsyncMock()
        session_cm.__aenter__ = AsyncMock(return_value=session)
        session_cm.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = session_cm

        tc = MagicMock()
        tc.endpoint = "cmd"
        tc.name = "tool1"

        with patch("backend.tasks.mcp_executor.asyncio") as mock_asyncio:
            mock_asyncio.timeout = MagicMock()
            mock_asyncio.timeout.__aenter__ = AsyncMock()
            mock_asyncio.timeout.__aexit__ = AsyncMock(return_value=False)
            from backend.tasks.mcp_executor import exec_stdio_mcp
            result = await exec_stdio_mcp(tc, "args")

        assert "[MCP Error]" in result
        assert "unknown" in result

    @patch("mcp.client.stdio.stdio_client")
    @patch("mcp.client.session.ClientSession")
    @patch("mcp.StdioServerParameters")
    async def test_success_no_content(self, mock_params, mock_session_cls, mock_stdio):
        mock_params.return_value = MagicMock()

        stdio_cm = AsyncMock()
        stdio_cm.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
        stdio_cm.__aexit__ = AsyncMock(return_value=False)
        mock_stdio.return_value = stdio_cm

        session = AsyncMock()
        result_mock = MagicMock()
        result_mock.isError = False
        result_mock.content = []
        session.call_tool = AsyncMock(return_value=result_mock)
        session.initialize = AsyncMock()

        session_cm = AsyncMock()
        session_cm.__aenter__ = AsyncMock(return_value=session)
        session_cm.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = session_cm

        tc = MagicMock()
        tc.endpoint = "cmd"
        tc.name = "tool1"

        with patch("backend.tasks.mcp_executor.asyncio") as mock_asyncio:
            mock_asyncio.timeout = MagicMock()
            mock_asyncio.timeout.__aenter__ = AsyncMock()
            mock_asyncio.timeout.__aexit__ = AsyncMock(return_value=False)
            from backend.tasks.mcp_executor import exec_stdio_mcp
            result = await exec_stdio_mcp(tc, "args")

        assert result == ""

    @patch("mcp.client.stdio.stdio_client")
    @patch("mcp.client.session.ClientSession")
    @patch("mcp.StdioServerParameters")
    async def test_timeout(self, mock_params, mock_session_cls, mock_stdio):
        mock_params.return_value = MagicMock()
        stdio_cm = AsyncMock()
        stdio_cm.__aenter__ = AsyncMock(side_effect=TimeoutError())
        stdio_cm.__aexit__ = AsyncMock(return_value=False)
        mock_stdio.return_value = stdio_cm

        tc = MagicMock()
        tc.endpoint = "cmd"
        tc.name = "tool1"

        with patch("backend.tasks.mcp_executor.asyncio") as mock_asyncio:
            mock_asyncio.timeout = MagicMock()
            mock_asyncio.timeout.__aenter__ = AsyncMock()
            mock_asyncio.timeout.__aexit__ = AsyncMock(return_value=False)
            from backend.tasks.mcp_executor import exec_stdio_mcp
            result = await exec_stdio_mcp(tc, "args")

        assert "[MCP Timeout]" in result
        assert tc.name in result

    @patch("mcp.client.stdio.stdio_client")
    @patch("mcp.client.session.ClientSession")
    @patch("mcp.StdioServerParameters")
    async def test_error_result_content_no_text_attr(self, mock_params, mock_session_cls, mock_stdio):
        """Error result with content item that lacks .text attr."""
        mock_params.return_value = MagicMock()

        stdio_cm = AsyncMock()
        stdio_cm.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
        stdio_cm.__aexit__ = AsyncMock(return_value=False)
        mock_stdio.return_value = stdio_cm

        session = AsyncMock()
        result_mock = MagicMock()
        result_mock.isError = True
        content_item = MagicMock(spec=[])  # no .text attribute
        result_mock.content = [content_item]
        session.call_tool = AsyncMock(return_value=result_mock)
        session.initialize = AsyncMock()

        session_cm = AsyncMock()
        session_cm.__aenter__ = AsyncMock(return_value=session)
        session_cm.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = session_cm

        tc = MagicMock()
        tc.endpoint = "cmd"
        tc.name = "tool1"

        with patch("backend.tasks.mcp_executor.asyncio") as mock_asyncio:
            mock_asyncio.timeout = MagicMock()
            mock_asyncio.timeout.__aenter__ = AsyncMock()
            mock_asyncio.timeout.__aexit__ = AsyncMock(return_value=False)
            from backend.tasks.mcp_executor import exec_stdio_mcp
            result = await exec_stdio_mcp(tc, "args")

        assert "[MCP Error]" in result
        assert "unknown" in result
