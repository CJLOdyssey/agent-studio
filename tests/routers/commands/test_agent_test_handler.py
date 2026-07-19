from unittest.mock import AsyncMock, MagicMock, patch


class TestAgentTestHandler:

    @patch("backend.repository.agents.get_agent_config", new_callable=AsyncMock, return_value=None)
    async def test_agent_not_found(self, mock_get, client):
        resp = client.post("/api/agents/nonexistent/test")
        assert resp.status_code == 404

    @patch("backend.repository.agents.get_agent_config", new_callable=AsyncMock)
    async def test_agent_test_no_api_key(self, mock_get, client):
        mock_agent = MagicMock()
        mock_agent.model = None
        mock_agent.system_prompt = "test prompt"
        mock_get.return_value = mock_agent

        with patch("backend.core.config.load_config") as mock_cfg, \
             patch("backend.repository.keys.get_default_api_key", new_callable=AsyncMock) as mock_key:
            mock_cfg.return_value = MagicMock(model="deepseek-chat")
            mock_key.return_value = None
            resp = client.post("/api/agents/test-agent-1/test")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert "No API key" in data["message"]

    @patch("backend.repository.agents.get_agent_config", new_callable=AsyncMock)
    async def test_agent_test_success(self, mock_get, client):
        mock_agent = MagicMock()
        mock_agent.model = "deepseek-chat"
        mock_agent.system_prompt = "test prompt"
        mock_get.return_value = mock_agent

        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("backend.core.config.load_config") as mock_cfg, \
             patch("backend.repository.keys.get_default_api_key", new_callable=AsyncMock) as mock_key:
            mock_cfg.return_value = MagicMock(model="deepseek-chat")
            mock_key.return_value = {"api_key": "test-key", "base_url": "https://api.test.com"}

            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.post = AsyncMock(return_value=mock_response)
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client

                resp = client.post("/api/agents/test-agent-2/test")
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True

    @patch("backend.repository.agents.get_agent_config", new_callable=AsyncMock)
    async def test_agent_test_http_error(self, mock_get, client):
        mock_agent = MagicMock()
        mock_agent.model = "deepseek-chat"
        mock_agent.system_prompt = "test prompt"
        mock_get.return_value = mock_agent

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("backend.core.config.load_config") as mock_cfg, \
             patch("backend.repository.keys.get_default_api_key", new_callable=AsyncMock) as mock_key:
            mock_cfg.return_value = MagicMock(model="deepseek-chat")
            mock_key.return_value = {"api_key": "test-key", "base_url": "https://api.test.com"}

            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.post = AsyncMock(return_value=mock_response)
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client

                resp = client.post("/api/agents/test-agent-3/test")
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is False
                assert "HTTP 500" in data["message"]

    @patch("backend.repository.agents.get_agent_config", new_callable=AsyncMock)
    async def test_agent_test_exception(self, mock_get, client):
        mock_agent = MagicMock()
        mock_agent.model = "deepseek-chat"
        mock_agent.system_prompt = "test prompt"
        mock_get.return_value = mock_agent

        with patch("backend.core.config.load_config", side_effect=Exception("config error")):
            resp = client.post("/api/agents/test-agent-4/test")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert "config error" in data["message"]
