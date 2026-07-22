from unittest.mock import AsyncMock, MagicMock, patch


class TestCommands:
    def test_list_commands_returns_all(self, client):
        resp = client.get("/api/commands")
        assert resp.status_code == 200
        cmds = resp.json()
        assert isinstance(cmds, list)
        ids = [c["id"] for c in cmds]
        assert "clear" in ids
        assert "export" in ids
        assert "rename" in ids
        assert "model" in ids
        assert "agents" in ids
        assert "help" in ids
        assert "shortcuts" in ids

    def test_list_commands_fields(self, client):
        resp = client.get("/api/commands")
        for cmd in resp.json():
            assert "id" in cmd
            assert "name" in cmd
            assert "description" in cmd
            assert "category" in cmd
            assert "enabled" in cmd
            assert cmd["enabled"] is True

    def test_get_command_found(self, client):
        resp = client.get("/api/commands/clear")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "clear"
        assert data["shortcut"] == "Ctrl+L"
        assert data["requires_input"] is False

    def test_get_command_rename_has_requires_input(self, client):
        resp = client.get("/api/commands/rename")
        assert resp.status_code == 200
        assert resp.json()["requires_input"] is True

    def test_get_command_not_found(self, client):
        resp = client.get("/api/commands/nonexistent")
        assert resp.status_code == 404

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_clear_command(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "clear", "session_id": "sess-1",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["action"] == "clear_conversation"

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_export_command(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "export", "session_id": "sess-1",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["action"] == "export_conversation"
        assert resp.json()["data"]["format"] == "markdown"

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_rename_command(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "rename", "session_id": "sess-1",
            "payload": {"title": "New Title"},
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert resp.json()["data"]["new_title"] == "New Title"

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_rename_empty_title(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "rename", "session_id": "sess-1",
            "payload": {"title": "  "},
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "不能为空" in resp.json()["message"]

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_rename_long_title(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "rename", "session_id": "sess-1",
            "payload": {"title": "x" * 257},
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "过长" in resp.json()["message"]

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    @patch("backend.routers.commands.update_session_title", new_callable=AsyncMock, side_effect=Exception("db error"))
    async def test_execute_rename_exception(self, mock_update, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "rename", "session_id": "sess-1",
            "payload": {"title": "Title"},
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "重命名失败" in resp.json()["message"]

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_model_command(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "model", "session_id": "sess-1",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["action"] == "open_settings"
        assert resp.json()["data"]["panel"] == "model"

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_agents_command(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "agents", "session_id": "sess-1",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["panel"] == "agents"

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_help_command(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "help", "session_id": "sess-1",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["action"] == "show_help"
        assert "commands" in resp.json()["data"]

    @patch("backend.routers.commands.log_command", new_callable=AsyncMock)
    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_shortcuts_command(self, mock_log, mock_get_session, client):
        mock_get_session.return_value = MagicMock()
        resp = client.post("/api/commands/execute", json={
            "command_id": "shortcuts", "session_id": "sess-1",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["action"] == "show_shortcuts"
        assert len(resp.json()["data"]["shortcuts"]) > 0

    def test_execute_unknown_command(self, client):
        resp = client.post("/api/commands/execute", json={
            "command_id": "nonexistent", "session_id": "sess-1",
        })
        assert resp.status_code == 404

    @patch("backend.routers.commands.get_session", new_callable=AsyncMock)
    async def test_execute_command_session_not_found(self, mock_get_session, client):
        mock_get_session.return_value = None
        resp = client.post("/api/commands/execute", json={
            "command_id": "clear", "session_id": "nonexistent",
        })
        assert resp.status_code == 404
