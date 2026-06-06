"""Business tests: direct calls to all router functions covering all logic paths."""
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, WebSocketDisconnect
from fastapi.responses import FileResponse


def _mock_request(user_id="user-1"):
    req = MagicMock()
    req.state = MagicMock()
    req.state.user_id = user_id
    return req


# ============================================================
# attachments.py
# ============================================================

class TestValidateUpload:
    def test_size_too_large_413(self):
        from virtual_team.routers.attachments import _validate_upload
        with pytest.raises(HTTPException) as exc:
            _validate_upload("text/plain", 11 * 1024 * 1024)
        assert exc.value.status_code == 413

    def test_unsupported_type_415(self):
        from virtual_team.routers.attachments import _validate_upload
        with pytest.raises(HTTPException) as exc:
            _validate_upload("application/x-binary", 100)
        assert exc.value.status_code == 415

    def test_valid(self):
        from virtual_team.routers.attachments import _validate_upload
        _validate_upload("text/plain", 100)


class TestExtractText:
    async def test_text_file(self):
        import tempfile
        fp = Path(tempfile.mktemp(suffix=".txt"))
        fp.write_text("hello world")
        from virtual_team.routers.attachments import _extract_text
        result = await _extract_text(fp, "text/plain")
        assert "hello" in result
        fp.unlink()

    async def test_json_file(self):
        import tempfile
        fp = Path(tempfile.mktemp(suffix=".json"))
        fp.write_text('{"key": "value"}')
        from virtual_team.routers.attachments import _extract_text
        result = await _extract_text(fp, "application/json")
        assert "key" in result
        fp.unlink()

    async def test_pdf_placeholder(self):
        from virtual_team.routers.attachments import _extract_text
        result = await _extract_text(MagicMock(), "application/pdf")
        assert "PDF" in result

    async def test_image_placeholder(self):
        fp = MagicMock(spec=Path)
        fp.stat().st_size = 1234
        from virtual_team.routers.attachments import _extract_text
        result = await _extract_text(fp, "image/png")
        assert "图片" in result

    async def test_exception_returns_empty(self):
        fp = MagicMock(spec=Path)
        fp.read_text = MagicMock(side_effect=Exception("bad"))
        from virtual_team.routers.attachments import _extract_text
        result = await _extract_text(fp, "text/plain")
        assert result == ""


class TestUploadAttachment:
    async def test_success(self):
        req = _mock_request()
        file = MagicMock()
        file.content_type = "text/plain"
        file.filename = "test.txt"
        file.read = AsyncMock(return_value=b"hello")

        mock_factory = MagicMock()
        mock_session = AsyncMock()
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=mock_session)
        ctx.__aexit__ = AsyncMock()
        mock_factory.return_value = ctx
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
            patch("virtual_team.routers.attachments.UPLOAD_DIR"),
        ):
            from virtual_team.routers.attachments import upload_attachment
            result = await upload_attachment(request=req, file=file, session_id="sess-1", run_id=None)
            assert result.filename == "test.txt"

    async def test_with_run_id(self):
        req = _mock_request()
        file = MagicMock()
        file.content_type = "text/plain"
        file.filename = "test.txt"
        file.read = AsyncMock(return_value=b"hello")
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.attachments.get_session_factory"),
            patch("virtual_team.routers.attachments.UPLOAD_DIR"),
        ):
            from virtual_team.routers.attachments import upload_attachment
            result = await upload_attachment(request=req, file=file, session_id="sess-1", run_id="run-1")
            assert result.run_id == "run-1"

    async def test_session_not_found_404(self):
        req = _mock_request()
        file = MagicMock()
        file.read = AsyncMock(return_value=b"data")
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.attachments import upload_attachment
            with pytest.raises(HTTPException) as exc:
                await upload_attachment(request=req, file=file, session_id="sess-1")
            assert exc.value.status_code == 404

    async def test_save_failure_500(self):
        req = _mock_request()
        file = MagicMock()
        file.content_type = "text/plain"
        file.filename = "test.txt"
        file.read = AsyncMock(return_value=b"data")

        mock_dir = MagicMock()
        mock_dir.__truediv__.return_value = mock_dir
        mock_dir.write_bytes = MagicMock(side_effect=OSError("disk full"))
        mock_dir.parent = MagicMock()

        mock_factory = MagicMock()
        mock_session = AsyncMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock()

        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
            patch("virtual_team.routers.attachments.UPLOAD_DIR", mock_dir),
        ):
            from virtual_team.routers.attachments import upload_attachment
            with pytest.raises(HTTPException) as exc:
                await upload_attachment(request=req, file=file, session_id="sess-1", run_id=None)
            assert exc.value.status_code == 500


class TestGetAttachment:
    async def test_success_returns_file_response(self):
        req = _mock_request()
        att = MagicMock()
        att.storage_path = "/tmp/exists.txt"
        att.content_type = "text/plain"
        att.filename = "test.txt"
        mock_factory = MagicMock()
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = att
        mock_session.execute.return_value = mock_result
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock()
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
            patch("pathlib.Path.exists", return_value=True),
        ):
            from virtual_team.routers.attachments import get_attachment
            result = await get_attachment("att-1", req)
            assert isinstance(result, FileResponse)

    async def test_not_found_404(self):
        req = _mock_request()
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        class FakeCtx:
            async def __aenter__(self):
                return mock_session
            async def __aexit__(self, *args):
                pass

        mock_factory = MagicMock(return_value=FakeCtx())
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
        ):
            from virtual_team.routers.attachments import get_attachment
            with pytest.raises(HTTPException) as exc:
                await get_attachment("att-1", req)
            assert exc.value.status_code == 404

    async def test_file_lost_410(self):
        req = _mock_request()
        att = MagicMock()
        att.storage_path = "/tmp/gone.txt"
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = att
        mock_session.execute = AsyncMock(return_value=mock_result)

        class FakeCtx:
            async def __aenter__(self):
                return mock_session
            async def __aexit__(self, *args):
                pass

        mock_factory = MagicMock(return_value=FakeCtx())
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
            patch("pathlib.Path.exists", return_value=False),
        ):
            from virtual_team.routers.attachments import get_attachment
            with pytest.raises(HTTPException) as exc:
                await get_attachment("att-1", req)
            assert exc.value.status_code == 410


class TestListSessionAttachments:
    async def test_success_empty(self):
        req = _mock_request()
        mock_factory = MagicMock()
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_scalar = MagicMock()
        mock_scalar.all.return_value = []
        mock_result.scalars.return_value = mock_scalar
        mock_session.execute.return_value = mock_result
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock()
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
        ):
            from virtual_team.routers.attachments import list_session_attachments
            result = await list_session_attachments("sess-1", req)
            assert result == []

    async def test_session_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.attachments import list_session_attachments
            with pytest.raises(HTTPException) as exc:
                await list_session_attachments("sess-1", req)
            assert exc.value.status_code == 404


class TestDeleteAttachment:
    async def test_success(self):
        req = _mock_request()
        att = MagicMock()
        att.storage_path = "/tmp/delete_me"
        mock_factory = MagicMock()
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = att
        mock_session.execute.return_value = mock_result
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock()
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
            patch("pathlib.Path.exists", return_value=True),
            patch("pathlib.Path.unlink"),
        ):
            from virtual_team.routers.attachments import delete_attachment
            result = await delete_attachment("att-1", req)
            assert result == {"success": True, "id": "att-1"}

    async def test_not_found_404(self):
        req = _mock_request()
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        class FakeCtx:
            async def __aenter__(self):
                return mock_session
            async def __aexit__(self, *args):
                pass

        mock_factory = MagicMock(return_value=FakeCtx())
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
        ):
            from virtual_team.routers.attachments import delete_attachment
            with pytest.raises(HTTPException) as exc:
                await delete_attachment("att-1", req)
            assert exc.value.status_code == 404

    async def test_delete_file_exception(self):
        """覆盖 attachment delete 时文件删除抛出异常的分支 (lines 188-189)."""
        req = _mock_request()
        att = MagicMock()
        att.storage_path = "/tmp/delete_me"
        mock_factory = MagicMock()
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = att
        mock_session.execute.return_value = mock_result
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock()
        with (
            patch("virtual_team.routers.attachments.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.attachments.get_session_factory", return_value=mock_factory),
            patch("pathlib.Path.exists", return_value=True),
            patch("pathlib.Path.unlink", side_effect=OSError("permission denied")),
        ):
            from virtual_team.routers.attachments import delete_attachment
            result = await delete_attachment("att-1", req)
            assert result == {"success": True, "id": "att-1"}


# ============================================================
# commands.py
# ============================================================

class TestListCommands:
    async def test_success(self):
        from virtual_team.routers.commands import list_commands
        result = await list_commands()
        assert len(result) > 0
        assert result[0].id == "clear"

    async def test_returns_command_response(self):
        from virtual_team.routers.commands import list_commands
        result = await list_commands()
        for cmd in result:
            assert hasattr(cmd, "id")
            assert hasattr(cmd, "name")
            assert hasattr(cmd, "description")


class TestGetCommand:
    async def test_success(self):
        from virtual_team.routers.commands import get_command
        result = await get_command("clear")
        assert result.id == "clear"
        assert result.name == "清空对话"

    async def test_not_found_404(self):
        from virtual_team.routers.commands import get_command
        with pytest.raises(HTTPException) as exc:
            await get_command("nonexistent")
        assert exc.value.status_code == 404

    async def test_rename_has_requires_input(self):
        from virtual_team.routers.commands import get_command
        result = await get_command("rename")
        assert result.requires_input is True


class TestExecuteCommand:
    async def test_success_clear(self):
        req = _mock_request()
        from virtual_team.models import CommandExecuteRequest
        cmd_req = CommandExecuteRequest(command_id="clear", session_id="sess-1")
        with (
            patch("virtual_team.routers.commands.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.commands.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.commands.get_session_factory"),
        ):
            from virtual_team.routers.commands import execute_command
            result = await execute_command(cmd_req, req)
            assert result.success is True

    async def test_unknown_command_404(self):
        req = _mock_request()
        from virtual_team.models import CommandExecuteRequest
        cmd_req = CommandExecuteRequest(command_id="bad", session_id="sess-1")
        with patch("virtual_team.routers.commands.get_user_id", return_value="user-1"):
            from virtual_team.routers.commands import execute_command
            with pytest.raises(HTTPException) as exc:
                await execute_command(cmd_req, req)
            assert exc.value.status_code == 404

    async def test_session_not_found_404(self):
        req = _mock_request()
        from virtual_team.models import CommandExecuteRequest
        cmd_req = CommandExecuteRequest(command_id="clear", session_id="sess-1")
        with (
            patch("virtual_team.routers.commands.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.commands.get_session", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.commands import execute_command
            with pytest.raises(HTTPException) as exc:
                await execute_command(cmd_req, req)
            assert exc.value.status_code == 404


class TestDispatchCommand:
    async def test_clear(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("clear", "sess-1", {})
        assert result.success is True

    async def test_export(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("export", "sess-1", {})
        assert result.success is True
        assert result.data["format"] == "markdown"

    async def test_rename_success(self):
        from virtual_team.routers.commands import _dispatch_command
        with patch("virtual_team.routers.commands.update_session_title", new_callable=AsyncMock):
            result = await _dispatch_command("rename", "sess-1", {"title": "新标题"})
            assert result.success is True

    async def test_rename_empty_title(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("rename", "sess-1", {"title": ""})
        assert result.success is False

    async def test_rename_title_too_long(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("rename", "sess-1", {"title": "x" * 257})
        assert result.success is False

    async def test_rename_db_failure(self):
        from virtual_team.routers.commands import _dispatch_command
        with patch("virtual_team.routers.commands.update_session_title", new_callable=AsyncMock, side_effect=Exception("db error")):
            result = await _dispatch_command("rename", "sess-1", {"title": "hi"})
            assert result.success is False

    async def test_model(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("model", "sess-1", {})
        assert result.data["panel"] == "model"

    async def test_agents(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("agents", "sess-1", {})
        assert result.data["panel"] == "agents"

    async def test_help(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("help", "sess-1", {})
        assert "commands" in result.data

    async def test_shortcuts(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("shortcuts", "sess-1", {})
        assert "shortcuts" in result.data

    async def test_unknown(self):
        from virtual_team.routers.commands import _dispatch_command
        result = await _dispatch_command("unknown", "sess-1", {})
        assert result.success is False


# ============================================================
# keys.py
# ============================================================

class TestListKeys:
    async def test_success(self):
        req = _mock_request()
        mock_keys = [
            {"id": "k1", "provider": "openai", "usage_type": "llm", "label": "my key",
             "key_masked": "sk-****", "base_url": None, "models": ["gpt-4"],
             "is_active": True, "is_default": False, "last_used_at": None, "created_at": None}
        ]
        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock, return_value=mock_keys):
            from virtual_team.routers.keys import list_keys
            result = await list_keys(req)
            assert len(result) == 1
            assert result[0].id == "k1"

    async def test_error_500(self):
        req = _mock_request()
        with patch("virtual_team.routers.keys.get_api_keys", new_callable=AsyncMock, side_effect=Exception("db error")):
            from virtual_team.routers.keys import list_keys
            with pytest.raises(HTTPException) as exc:
                await list_keys(req)
            assert exc.value.status_code == 500


class TestAddKey:
    async def test_success_llm(self):
        req = _mock_request()
        from virtual_team.routers.keys import KeyCreateRequest
        k_req = KeyCreateRequest(provider="openai", label="test", api_key="sk-test", usage_type="llm")
        mock_obj = MagicMock()
        mock_obj.id = "k1"
        mock_obj.provider = "openai"
        mock_obj.usage_type = "llm"
        mock_obj.label = "test"
        mock_obj.encrypted_key = "encrypted"
        mock_obj.base_url = None
        mock_obj.models = []
        mock_obj.is_active = True
        mock_obj.is_default = False
        mock_obj.last_used_at = None
        mock_obj.created_at = None
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.create_api_key", new_callable=AsyncMock, return_value=mock_obj),
            patch("virtual_team.routers.keys.test_api_key_connection", new_callable=AsyncMock, return_value={"success": True, "models": ["gpt-4"]}),
            patch("virtual_team.routers.keys.update_api_key", new_callable=AsyncMock),
            patch("virtual_team.key_vault.mask_api_key", return_value="sk-****"),
            patch("virtual_team.key_vault.decrypt_api_key", return_value="sk-test"),
        ):
            from virtual_team.routers.keys import add_key
            result = await add_key(k_req, req)
            assert result.id == "k1"

    async def test_connection_failure_400(self):
        req = _mock_request()
        from virtual_team.routers.keys import KeyCreateRequest
        k_req = KeyCreateRequest(provider="openai", label="test", api_key="sk-test", usage_type="llm")
        mock_obj = MagicMock()
        mock_obj.id = "k1"
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.create_api_key", new_callable=AsyncMock, return_value=mock_obj),
            patch("virtual_team.routers.keys.test_api_key_connection", new_callable=AsyncMock, return_value={"success": False, "message": "bad key"}),
            patch("virtual_team.routers.keys.delete_api_key", new_callable=AsyncMock),
        ):
            from virtual_team.routers.keys import add_key
            with pytest.raises(HTTPException) as exc:
                await add_key(k_req, req)
            assert exc.value.status_code == 400

    async def test_embedding_skips_test(self):
        req = _mock_request()
        from virtual_team.routers.keys import KeyCreateRequest
        k_req = KeyCreateRequest(provider="openai", label="test", api_key="sk-test", usage_type="embedding")
        mock_obj = MagicMock()
        mock_obj.id = "k1"
        mock_obj.provider = "openai"
        mock_obj.usage_type = "embedding"
        mock_obj.label = "test"
        mock_obj.encrypted_key = "encrypted"
        mock_obj.base_url = None
        mock_obj.models = []
        mock_obj.is_active = True
        mock_obj.is_default = False
        mock_obj.last_used_at = None
        mock_obj.created_at = None
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.create_api_key", new_callable=AsyncMock, return_value=mock_obj),
            patch("virtual_team.key_vault.mask_api_key", return_value="sk-****"),
            patch("virtual_team.key_vault.decrypt_api_key", return_value="sk-test"),
        ):
            from virtual_team.routers.keys import add_key
            result = await add_key(k_req, req)
            assert result.id == "k1"
            assert result.models == []


class TestEditKey:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.keys import KeyUpdateRequest
        k_req = KeyUpdateRequest(label="new label")
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.update_api_key", new_callable=AsyncMock, return_value={
                "id": "k1", "provider": "openai", "usage_type": "llm", "label": "new label",
                "key_masked": "sk-****", "base_url": None, "models": [], "is_active": True,
                "is_default": False, "last_used_at": None, "created_at": None,
            }),
        ):
            from virtual_team.routers.keys import edit_key
            result = await edit_key("k1", k_req, req)
            assert result.id == "k1"

    async def test_not_found_404(self):
        req = _mock_request()
        from virtual_team.routers.keys import KeyUpdateRequest
        k_req = KeyUpdateRequest(label="new")
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.update_api_key", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.keys import edit_key
            with pytest.raises(HTTPException) as exc:
                await edit_key("k1", k_req, req)
            assert exc.value.status_code == 404

    async def test_revalidates_on_key_change(self):
        req = _mock_request()
        from virtual_team.routers.keys import KeyUpdateRequest
        k_req = KeyUpdateRequest(api_key="sk-new")
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.update_api_key", new_callable=AsyncMock, return_value={
                "id": "k1", "provider": "openai", "usage_type": "llm", "label": "test",
                "key_masked": "sk-****", "base_url": None, "models": [], "is_active": True,
                "is_default": False, "last_used_at": None, "created_at": None,
            }),
            patch("virtual_team.routers.keys.test_api_key_connection", new_callable=AsyncMock, return_value={"success": True, "models": ["gpt-4"]}),
        ):
            from virtual_team.routers.keys import edit_key
            result = await edit_key("k1", k_req, req)
            assert result.id == "k1"


class TestRemoveKey:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.delete_api_key", new_callable=AsyncMock, return_value=True),
        ):
            from virtual_team.routers.keys import remove_key
            result = await remove_key("k1", req)
            assert result == {"status": "deleted", "id": "k1"}

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.delete_api_key", new_callable=AsyncMock, return_value=False),
        ):
            from virtual_team.routers.keys import remove_key
            with pytest.raises(HTTPException) as exc:
                await remove_key("k1", req)
            assert exc.value.status_code == 404


class TestTestKeyConnection:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.test_api_key_connection", new_callable=AsyncMock, return_value={"success": True, "message": "OK"}),
        ):
            from virtual_team.routers.keys import test_key_connection
            result = await test_key_connection("k1", req)
            assert result["success"] is True

    async def test_failure(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.test_api_key_connection", new_callable=AsyncMock, return_value={"success": False, "message": "fail"}),
        ):
            from virtual_team.routers.keys import test_key_connection
            result = await test_key_connection("k1", req)
            assert result["success"] is False


class TestFetchModelsFromProvider:
    async def test_success(self):
        from virtual_team.routers.keys import FetchModelsRequest
        req = FetchModelsRequest(api_key="sk-test", provider="openai")
        with (
            patch("virtual_team.routers.keys.asyncio.to_thread", new_callable=AsyncMock, return_value={"success": True, "models": ["gpt-4"]}),
        ):
            from virtual_team.routers.keys import fetch_models_from_provider
            result = await fetch_models_from_provider(req)
            assert result["success"] is True
            assert "gpt-4" in result["models"]

    async def test_failure(self):
        from virtual_team.routers.keys import FetchModelsRequest
        req = FetchModelsRequest(api_key="sk-test")
        with (
            patch("virtual_team.routers.keys.asyncio.to_thread", new_callable=AsyncMock, return_value={"success": False, "message": "bad"}),
        ):
            from virtual_team.routers.keys import fetch_models_from_provider
            result = await fetch_models_from_provider(req)
            assert result["success"] is False


class TestKeyUsage:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.get_key_usage_stats", new_callable=AsyncMock, return_value={"total_tokens": 1000}),
        ):
            from virtual_team.routers.keys import key_usage
            result = await key_usage(req)
            assert result["total_tokens"] == 1000

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.keys.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.keys.get_key_usage_stats", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.keys import key_usage
            with pytest.raises(HTTPException) as exc:
                await key_usage(req)
            assert exc.value.status_code == 500


# ============================================================
# models.py
# ============================================================

class TestGetModelsFromKeys:
    async def test_success(self):
        mock_keys = [
            {"provider": "openai", "is_active": True, "models": ["gpt-4", "gpt-3.5"]},
            {"provider": "anthropic", "is_active": True, "models": ["claude-3"]},
        ]
        with patch("virtual_team.routers.models.get_api_keys", new_callable=AsyncMock, return_value=mock_keys):
            from virtual_team.routers.models import _get_models_from_keys
            result = await _get_models_from_keys("user-1")
            assert len(result) == 3

    async def test_deduplicates_models(self):
        mock_keys = [
            {"provider": "openai", "is_active": True, "models": ["gpt-4", "gpt-4"]},
        ]
        with patch("virtual_team.routers.models.get_api_keys", new_callable=AsyncMock, return_value=mock_keys):
            from virtual_team.routers.models import _get_models_from_keys
            result = await _get_models_from_keys("user-1")
            assert len(result) == 1

    async def test_skips_inactive_keys(self):
        mock_keys = [
            {"provider": "openai", "is_active": False, "models": ["gpt-4"]},
        ]
        with patch("virtual_team.routers.models.get_api_keys", new_callable=AsyncMock, return_value=mock_keys):
            from virtual_team.routers.models import _get_models_from_keys
            result = await _get_models_from_keys("user-1")
            assert result == []

    async def test_exception_returns_empty(self):
        with patch("virtual_team.routers.models.get_api_keys", new_callable=AsyncMock, side_effect=Exception("db error")):
            from virtual_team.routers.models import _get_models_from_keys
            result = await _get_models_from_keys("user-1")
            assert result == []

    async def test_unknown_provider_label(self):
        mock_keys = [
            {"provider": "unknown_provider", "is_active": True, "models": ["custom-model"]},
        ]
        with patch("virtual_team.routers.models.get_api_keys", new_callable=AsyncMock, return_value=mock_keys):
            from virtual_team.routers.models import _get_models_from_keys
            result = await _get_models_from_keys("user-1")
            assert result[0].id == "custom-model"


class TestListModels:
    async def test_success(self):
        req = _mock_request()
        mock_keys = [
            {"provider": "openai", "is_active": True, "models": ["gpt-4"]},
        ]
        with patch("virtual_team.routers.models.get_api_keys", new_callable=AsyncMock, return_value=mock_keys):
            from virtual_team.routers.models import list_models
            result = await list_models(req)
            assert len(result) == 1
            assert result[0].id == "gpt-4"


# ============================================================
# runs.py
# ============================================================

class TestCreateRun:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app")
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.create_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_default_api_key", new_callable=AsyncMock, return_value={"api_key": "sk-test", "base_url": None}),
            patch("virtual_team.routers.runs.update_session_title", new_callable=AsyncMock),
            patch("virtual_team.repository.create_run", new_callable=AsyncMock, return_value="run-1"),
            patch("virtual_team.tasks.run_agent") as mock_ra,
        ):
            from virtual_team.routers.runs import create_run
            result = await create_run(run_req, req)
            assert result.run_id == "run-1"
            assert result.status == "pending"
            mock_ra.delay.assert_called_once()

    async def test_empty_requirement_400(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="   ")
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with patch("virtual_team.routers.runs.load_config", return_value=mock_config):
            from virtual_team.routers.runs import create_run
            with pytest.raises(HTTPException) as exc:
                await create_run(run_req, req)
            assert exc.value.status_code == 400

    async def test_no_api_key_400(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app")
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.create_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_default_api_key", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.runs import create_run
            with pytest.raises(HTTPException) as exc:
                await create_run(run_req, req)
            assert exc.value.status_code == 400

    async def test_db_create_failure_500(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app")
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.create_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_default_api_key", new_callable=AsyncMock, return_value={"api_key": "sk-test", "base_url": None}),
            patch("virtual_team.repository.create_run", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.runs import create_run
            with pytest.raises(HTTPException) as exc:
                await create_run(run_req, req)
            assert exc.value.status_code == 500

    async def test_with_existing_session_id(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app", session_id="sess-1")
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.get_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_default_api_key", new_callable=AsyncMock, return_value={"api_key": "sk-test", "base_url": None}),
            patch("virtual_team.routers.runs.update_session_title", new_callable=AsyncMock),
            patch("virtual_team.repository.create_run", new_callable=AsyncMock, return_value="run-1"),
            patch("virtual_team.tasks.run_agent"),
        ):
            from virtual_team.routers.runs import create_run
            result = await create_run(run_req, req)
            assert result.session_id == "sess-1"

    async def test_session_id_not_found_creates_new(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app", session_id="sess-missing")
        mock_session = MagicMock()
        mock_session.id = "sess-new"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.get_session", new_callable=AsyncMock, return_value=None),
            patch("virtual_team.routers.runs.create_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_default_api_key", new_callable=AsyncMock, return_value={"api_key": "sk-test", "base_url": None}),
            patch("virtual_team.routers.runs.update_session_title", new_callable=AsyncMock),
            patch("virtual_team.repository.create_run", new_callable=AsyncMock, return_value="run-1"),
            patch("virtual_team.tasks.run_agent"),
        ):
            from virtual_team.routers.runs import create_run
            result = await create_run(run_req, req)
            assert result.session_id == "sess-new"

    async def test_requirement_too_long_400(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        # RunRequest max_length=2000, so use 150 chars and set config limit to 100
        run_req = RunRequest(requirement="x" * 150)
        mock_config = MagicMock()
        mock_config.max_requirement_length = 100
        with (
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
        ):
            from virtual_team.routers.runs import create_run
            with pytest.raises(HTTPException) as exc:
                await create_run(run_req, req)
            assert exc.value.status_code == 400
            assert "不能超过" in exc.value.detail

    async def test_with_key_id(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app", key_id="key-1")
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.create_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_api_key_for_use", new_callable=AsyncMock, return_value={"api_key": "sk-key", "base_url": "https://api.example.com"}),
            patch("virtual_team.repository.create_run", new_callable=AsyncMock, return_value="run-1"),
            patch("virtual_team.routers.runs.update_session_title", new_callable=AsyncMock),
            patch("virtual_team.tasks.run_agent"),
        ):
            from virtual_team.routers.runs import create_run
            result = await create_run(run_req, req)
            assert result.run_id == "run-1"

    async def test_key_vault_exception(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app")
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        # Mock key vault returning a key WITHOUT base_url → KeyError on base_url access
        # This hits lines 86-87 (except Exception / logger.warning) while api_key is already set
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.create_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_default_api_key", new_callable=AsyncMock, return_value={"api_key": "sk-test", "unexpected": "no base_url"}),
            patch("virtual_team.repository.create_run", new_callable=AsyncMock, return_value="run-1"),
            patch("virtual_team.routers.runs.update_session_title", new_callable=AsyncMock),
            patch("virtual_team.tasks.run_agent"),
        ):
            from virtual_team.routers.runs import create_run
            result = await create_run(run_req, req)
            assert result.run_id == "run-1"

    async def test_task_enqueue_error(self):
        req = _mock_request()
        from virtual_team.routers.runs import RunRequest
        run_req = RunRequest(requirement="build a web app")
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_config = MagicMock()
        mock_config.max_requirement_length = 2000
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.load_config", return_value=mock_config),
            patch("virtual_team.routers.runs.create_session", new_callable=AsyncMock, return_value=mock_session),
            patch("virtual_team.routers.runs.get_default_api_key", new_callable=AsyncMock, return_value={"api_key": "sk-test", "base_url": None}),
            patch("virtual_team.routers.runs.update_session_title", new_callable=AsyncMock),
            patch("virtual_team.routers.runs.update_run_status", new_callable=AsyncMock),
            patch("virtual_team.repository.create_run", new_callable=AsyncMock, return_value="run-1"),
            patch("virtual_team.tasks.run_agent") as mock_ra,
        ):
            mock_ra.delay.side_effect = Exception("broker down")
            from virtual_team.routers.runs import create_run
            result = await create_run(run_req, req)
            assert result.run_id == "run-1"


class TestGetRunDetail:
    async def test_success(self):
        req = _mock_request()
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.session_id = "sess-1"
        mock_run.requirement = "test"
        mock_run.pm_document = "doc"
        mock_run.code = "code"
        mock_run.review = "review"
        mock_run.approved = False
        mock_run.status = "converged"
        mock_run.created_at = datetime(2024, 1, 1)
        mock_run.updated_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
        ):
            from virtual_team.routers.runs import get_run_detail
            result = await get_run_detail("run-1", req)
            assert result["id"] == "run-1"
            assert result["messages"] == []

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.runs import get_run_detail
            with pytest.raises(HTTPException) as exc:
                await get_run_detail("run-1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.runs import get_run_detail
            with pytest.raises(HTTPException) as exc:
                await get_run_detail("run-1", req)
            assert exc.value.status_code == 500


class TestListRuns:
    async def test_success(self):
        req = _mock_request()
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.session_id = "sess-1"
        mock_run.requirement = "test"
        mock_run.pm_document = ""
        mock_run.code = ""
        mock_run.review = ""
        mock_run.approved = False
        mock_run.status = "pending"
        mock_run.created_at = datetime(2024, 1, 1)
        mock_run.updated_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.get_runs", new_callable=AsyncMock, return_value=[mock_run]),
        ):
            from virtual_team.routers.runs import list_runs
            result = await list_runs(req)
            assert len(result) == 1
            assert result[0]["id"] == "run-1"

    async def test_empty(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.get_runs", new_callable=AsyncMock, return_value=[]),
        ):
            from virtual_team.routers.runs import list_runs
            result = await list_runs(req)
            assert result == []

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.get_runs", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.runs import list_runs
            with pytest.raises(HTTPException) as exc:
                await list_runs(req)
            assert exc.value.status_code == 500

    async def test_caps_limit(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.runs.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.runs.get_runs", new_callable=AsyncMock, return_value=[]),
        ):
            from virtual_team.routers.runs import list_runs
            await list_runs(req, limit=200)
            from virtual_team.routers.runs import get_runs
            get_runs.assert_called_once_with(limit=100, user_id="user-1")


class TestRunWebSocket:
    """Direct function tests for run_websocket — covers remaining WS exception paths."""

    async def test_outer_websocket_disconnect_line250(self):
        """connected send_json raises WebSocketDisconnect → outer handler (lines 249-250)."""
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock(side_effect=WebSocketDisconnect())
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        from virtual_team.routers.runs import run_websocket

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run"),
        ):
            await run_websocket(mock_ws, "run-1")
            assert mock_ws.accept.called

    async def test_outer_generic_exception_line252(self):
        """connected send_json raises RuntimeError → outer Exception handler (lines 251-252)."""
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock(side_effect=RuntimeError("boom"))
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        from virtual_team.routers.runs import run_websocket

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run"),
        ):
            await run_websocket(mock_ws, "run-1")
            assert mock_ws.accept.called

    async def test_outer_generic_exception(self):
        """Outer generic Exception handler (lines 251-252)."""
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock(side_effect=[RuntimeError("unexpected"), None])
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        from virtual_team.routers.runs import run_websocket

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=StopAsyncIteration()),
        ):
            await run_websocket(mock_ws, "run-1")
            assert mock_ws.accept.called

    async def test_auth_enabled_no_token(self):
        """AUTH_ENABLED=True but no valid token — closes with 4001 (lines 194-199)."""
        mock_ws = AsyncMock()
        mock_ws.query_params = {"token": ""}
        mock_ws.close = AsyncMock()

        from virtual_team.routers.runs import run_websocket

        with patch("virtual_team.auth.AUTH_ENABLED", True):
            await run_websocket(mock_ws, "run-1")
            mock_ws.close.assert_called_with(code=4001, reason="Unauthorized")

    async def test_websocket_disconnect_during_send(self):
        """send_json in subscribe loop raises WebSocketDisconnect (lines 239-241)."""
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        mock_ws.send_json.side_effect = [None, WebSocketDisconnect()]
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        async def _mock_subscribe(_run_id):
            yield {"type": "message", "role": "pm", "content": "test"}
            yield {"type": "message", "role": "dev", "content": "test2"}

        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.status = "running"

        from virtual_team.routers.runs import run_websocket

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe),
        ):
            await run_websocket(mock_ws, "run-1")
            assert mock_ws.accept.called

    async def test_send_json_generic_exception(self):
        """send_json in subscribe loop raises generic Exception (lines 242-244)."""
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        mock_ws.send_json.side_effect = [None, RuntimeError("send failed")]
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        async def _mock_subscribe(_run_id):
            yield {"type": "message", "content": "test"}

        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.status = "running"

        from virtual_team.routers.runs import run_websocket

        with (
            patch("virtual_team.routers.runs.get_run", new_callable=AsyncMock, return_value=mock_run),
            patch("virtual_team.routers.runs.get_messages", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.runs.subscribe_run", side_effect=_mock_subscribe),
        ):
            await run_websocket(mock_ws, "run-1")
            assert mock_ws.accept.called


# ============================================================
# sessions.py
# ============================================================

class TestListSessions:
    async def test_success(self):
        req = _mock_request()
        mock_session = MagicMock()
        mock_session.id = "sess-1"
        mock_session.title = "test"
        mock_session.created_at = datetime(2024, 1, 1)
        mock_session.updated_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_sessions", new_callable=AsyncMock, return_value=[mock_session]),
            patch("virtual_team.routers.sessions.get_runs_by_session_ids", new_callable=AsyncMock, return_value={"sess-1": []}),
        ):
            from virtual_team.routers.sessions import list_sessions
            result = await list_sessions(req)
            assert len(result) == 1
            assert result[0]["id"] == "sess-1"

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_sessions", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import list_sessions
            with pytest.raises(HTTPException) as exc:
                await list_sessions(req)
            assert exc.value.status_code == 500

    async def test_caps_limit(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_sessions", new_callable=AsyncMock, return_value=[]),
            patch("virtual_team.routers.sessions.get_runs_by_session_ids", new_callable=AsyncMock, return_value={}),
        ):
            from virtual_team.routers.sessions import list_sessions
            await list_sessions(req, limit=200)
            from virtual_team.routers.sessions import get_sessions
            get_sessions.assert_called_once_with(limit=100, user_id="user-1")


class TestAddSession:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.sessions import SessionCreateRequest
        s_req = SessionCreateRequest(title="新对话")
        mock_sess = MagicMock()
        mock_sess.id = "sess-1"
        mock_sess.title = "新对话"
        mock_sess.created_at = datetime(2024, 1, 1)
        mock_sess.updated_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.create_session", new_callable=AsyncMock, return_value=mock_sess),
        ):
            from virtual_team.routers.sessions import add_session
            result = await add_session(s_req, req)
            assert result["id"] == "sess-1"

    async def test_error_500(self):
        req = _mock_request()
        from virtual_team.routers.sessions import SessionCreateRequest
        s_req = SessionCreateRequest(title="新对话")
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.create_session", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import add_session
            with pytest.raises(HTTPException) as exc:
                await add_session(s_req, req)
            assert exc.value.status_code == 500


class TestGetSessionDetail:
    async def test_success(self):
        req = _mock_request()
        mock_sess = MagicMock()
        mock_sess.id = "sess-1"
        mock_sess.title = "test"
        mock_sess.created_at = datetime(2024, 1, 1)
        mock_sess.updated_at = datetime(2024, 1, 1)
        mock_run = MagicMock()
        mock_run.id = "run-1"
        mock_run.requirement = "test"
        mock_run.pm_document = ""
        mock_run.code = ""
        mock_run.review = ""
        mock_run.approved = False
        mock_run.status = "pending"
        mock_run.created_at = datetime(2024, 1, 1)
        mock_run.updated_at = datetime(2024, 1, 1)
        mock_memory = MagicMock()
        mock_memory.id = "mem-1"
        mock_memory.agent_role = "pm"
        mock_memory.content_type = "decision"
        mock_memory.summary = "summary"
        mock_memory.details = "details"
        mock_memory.created_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=mock_sess),
            patch("virtual_team.routers.sessions.get_session_runs", new_callable=AsyncMock, return_value=[mock_run]),
            patch("virtual_team.routers.sessions.get_session_memories", new_callable=AsyncMock, return_value=[mock_memory]),
        ):
            from virtual_team.routers.sessions import get_session_detail
            result = await get_session_detail("sess-1", req)
            assert result["id"] == "sess-1"
            assert len(result["runs"]) == 1
            assert len(result["memories"]) == 1

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.sessions import get_session_detail
            with pytest.raises(HTTPException) as exc:
                await get_session_detail("sess-1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import get_session_detail
            with pytest.raises(HTTPException) as exc:
                await get_session_detail("sess-1", req)
            assert exc.value.status_code == 500


class TestRenameSession:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.sessions import SessionUpdateRequest
        s_req = SessionUpdateRequest(title="新标题")
        mock_sess = MagicMock()
        mock_sess.id = "sess-1"
        mock_sess.title = "新标题"
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.update_session_title", new_callable=AsyncMock, return_value=mock_sess),
        ):
            from virtual_team.routers.sessions import rename_session
            result = await rename_session("sess-1", s_req, req)
            assert result["status"] == "updated"

    async def test_not_found_404(self):
        req = _mock_request()
        from virtual_team.routers.sessions import SessionUpdateRequest
        s_req = SessionUpdateRequest(title="新标题")
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.update_session_title", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.sessions import rename_session
            with pytest.raises(HTTPException) as exc:
                await rename_session("sess-1", s_req, req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        from virtual_team.routers.sessions import SessionUpdateRequest
        s_req = SessionUpdateRequest(title="新标题")
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.update_session_title", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import rename_session
            with pytest.raises(HTTPException) as exc:
                await rename_session("sess-1", s_req, req)
            assert exc.value.status_code == 500


class TestRemoveSession:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.delete_session", new_callable=AsyncMock, return_value=True),
        ):
            from virtual_team.routers.sessions import remove_session
            result = await remove_session("sess-1", req)
            assert result == {"status": "deleted"}

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.delete_session", new_callable=AsyncMock, return_value=False),
        ):
            from virtual_team.routers.sessions import remove_session
            with pytest.raises(HTTPException) as exc:
                await remove_session("sess-1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.delete_session", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import remove_session
            with pytest.raises(HTTPException) as exc:
                await remove_session("sess-1", req)
            assert exc.value.status_code == 500


class TestListSessionMemories:
    async def test_success(self):
        req = _mock_request()
        mock_memory = MagicMock()
        mock_memory.id = "mem-1"
        mock_memory.agent_role = "pm"
        mock_memory.content_type = "decision"
        mock_memory.summary = "summary"
        mock_memory.details = "details"
        mock_memory.created_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.sessions.get_session_memories", new_callable=AsyncMock, return_value=[mock_memory]),
        ):
            from virtual_team.routers.sessions import list_session_memories
            result = await list_session_memories("sess-1", req)
            assert len(result) == 1
            assert result[0]["id"] == "mem-1"

    async def test_session_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.sessions import list_session_memories
            with pytest.raises(HTTPException) as exc:
                await list_session_memories("sess-1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.sessions.get_session_memories", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import list_session_memories
            with pytest.raises(HTTPException) as exc:
                await list_session_memories("sess-1", req)
            assert exc.value.status_code == 500


class TestDeleteSessionMemory:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.delete_memory_entry", new_callable=AsyncMock, return_value=True),
        ):
            from virtual_team.routers.sessions import delete_session_memory
            result = await delete_session_memory("mem-1", req)
            assert result == {"status": "deleted"}

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.delete_memory_entry", new_callable=AsyncMock, return_value=False),
        ):
            from virtual_team.routers.sessions import delete_session_memory
            with pytest.raises(HTTPException) as exc:
                await delete_session_memory("mem-1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.delete_memory_entry", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import delete_session_memory
            with pytest.raises(HTTPException) as exc:
                await delete_session_memory("mem-1", req)
            assert exc.value.status_code == 500


class TestExportSessionMemories:
    async def test_success_json(self):
        req = _mock_request()
        mock_memory = MagicMock()
        mock_memory.id = "mem-1"
        mock_memory.agent_role = "pm"
        mock_memory.content_type = "decision"
        mock_memory.summary = "summary"
        mock_memory.details = "details"
        mock_memory.created_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.sessions.get_session_memories", new_callable=AsyncMock, return_value=[mock_memory]),
        ):
            from virtual_team.routers.sessions import export_session_memories
            result = await export_session_memories("sess-1", req, format="json")
            assert result.media_type == "application/json"

    async def test_success_md(self):
        req = _mock_request()
        mock_memory = MagicMock()
        mock_memory.id = "mem-1"
        mock_memory.agent_role = "pm"
        mock_memory.content_type = "decision"
        mock_memory.summary = "summary"
        mock_memory.details = "details"
        mock_memory.created_at = datetime(2024, 1, 1)
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.sessions.get_session_memories", new_callable=AsyncMock, return_value=[mock_memory]),
        ):
            from virtual_team.routers.sessions import export_session_memories
            result = await export_session_memories("sess-1", req, format="md")
            assert result.media_type == "text/markdown"

    async def test_invalid_format_400(self):
        req = _mock_request()
        from virtual_team.routers.sessions import export_session_memories
        with pytest.raises(HTTPException) as exc:
            await export_session_memories("sess-1", req, format="xml")
        assert exc.value.status_code == 400

    async def test_session_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.sessions import export_session_memories
            with pytest.raises(HTTPException) as exc:
                await export_session_memories("sess-1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.sessions.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.sessions.get_session", new_callable=AsyncMock, return_value=MagicMock()),
            patch("virtual_team.routers.sessions.get_session_memories", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.sessions import export_session_memories
            with pytest.raises(HTTPException) as exc:
                await export_session_memories("sess-1", req)
            assert exc.value.status_code == 500


# ============================================================
# skills.py
# ============================================================

class TestGenerateSkillFromDescription:
    def test_code_review(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("帮我做代码审查", "general")
        assert result.is_valid is True
        assert "review" in result.name

    def test_security(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("检查安全漏洞", "general")
        assert result.category == "security"

    def test_api_design(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("设计RESTful API接口", "general")
        assert result.category == "architecture"

    def test_testing(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("编写单元测试", "general")
        assert result.category == "quality-assurance"

    def test_documentation(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("编写项目文档", "general")
        assert result.category == "documentation"

    def test_database(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("数据库迁移方案", "general")
        assert result.is_valid is True

    def test_deployment(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("Docker部署方案", "general")
        assert result.is_valid is True

    def test_custom_fallback(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("一些随机描述文字", "general")
        assert result.is_valid is True

    def test_english_keywords_code_review(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("code review my changes", "general")
        assert "review" in result.name

    def test_english_keywords_security(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("security audit", "general")
        assert result.category == "security"

    def test_performance(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("性能优化建议", "general")
        assert result.category == "performance"

    def test_refactoring(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("重构代码结构", "general")
        assert "refactoring" in result.name

    def test_git_workflow(self):
        from virtual_team.routers.skills import _generate_skill_from_description
        result = _generate_skill_from_description("git提交规范", "general")
        assert "git" in result.name


class TestValidateSkillContent:
    def test_valid_content(self):
        from virtual_team.routers.skills import _validate_skill_content
        content = "---\nname: test\ndescription: test\n---\n# Title\n## Section\ncontent here"
        result = _validate_skill_content(content)
        assert result.is_valid is True

    def test_missing_frontmatter(self):
        from virtual_team.routers.skills import _validate_skill_content
        result = _validate_skill_content("no frontmatter")
        assert result.is_valid is False
        assert any("YAML" in s for s in result.suggestions)

    def test_missing_name(self):
        from virtual_team.routers.skills import _validate_skill_content
        content = "---\ndescription: test\n---\n# Title"
        result = _validate_skill_content(content)
        assert result.is_valid is False

    def test_short_content_suggestion(self):
        from virtual_team.routers.skills import _validate_skill_content
        result = _validate_skill_content("short")
        assert any("较短" in s for s in result.suggestions)

    def test_missing_headings(self):
        from virtual_team.routers.skills import _validate_skill_content
        content = "---\nname: test\ndescription: test\n---\nplain text"
        result = _validate_skill_content(content)
        assert any("标题" in s for s in result.suggestions)


class TestGenerateSkill:
    async def test_success(self):
        from virtual_team.routers.skills import SkillGenerateRequest
        skill_req = SkillGenerateRequest(description="代码审查", category="general")
        from virtual_team.routers.skills import generate_skill
        result = await generate_skill(skill_req)
        assert result.is_valid is True

    async def test_error_500(self):
        from virtual_team.routers.skills import SkillGenerateRequest
        skill_req = SkillGenerateRequest(description="代码审查", category="general")
        with patch("virtual_team.routers.skills._generate_skill_from_description", side_effect=Exception("gen error")):
            from virtual_team.routers.skills import generate_skill
            with pytest.raises(HTTPException) as exc:
                await generate_skill(skill_req)
            assert exc.value.status_code == 500


class TestValidateSkill:
    async def test_success(self):
        from virtual_team.routers.skills import SkillValidateRequest
        val_req = SkillValidateRequest(content="---\nname: test\ndescription: test\n---\n# Title\n## Section")
        from virtual_team.routers.skills import validate_skill
        result = await validate_skill(val_req)
        assert result.is_valid is True

    async def test_error_500(self):
        from virtual_team.routers.skills import SkillValidateRequest
        val_req = SkillValidateRequest(content="test")
        with patch("virtual_team.routers.skills._validate_skill_content", side_effect=Exception("val error")):
            from virtual_team.routers.skills import validate_skill
            with pytest.raises(HTTPException) as exc:
                await validate_skill(val_req)
            assert exc.value.status_code == 500


# ============================================================
# system_team.py
# ============================================================

class TestSystemTeamGetTeamInfo:
    async def test_success(self):
        mock_manager = MagicMock()
        mock_manager.get_team_info.return_value = {"name": "System Team", "agents": 5}
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_manager):
            from virtual_team.routers.system_team import get_team_info
            result = await get_team_info()
            assert result["name"] == "System Team"


class TestSystemTeamListAgents:
    async def test_success(self):
        mock_manager = MagicMock()
        mock_manager.list_agents.return_value = [{"id": "agent-1"}]
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_manager):
            from virtual_team.routers.system_team import list_agents
            result = await list_agents()
            assert len(result) == 1


class TestSystemTeamGetAgentConfig:
    async def test_success(self):
        mock_manager = MagicMock()
        mock_manager.get_agent_config.return_value = {"id": "agent-1", "model": "gpt-4"}
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_manager):
            from virtual_team.routers.system_team import get_agent_config
            result = await get_agent_config("agent-1")
            assert result["id"] == "agent-1"

    async def test_not_found_404(self):
        mock_manager = MagicMock()
        mock_manager.get_agent_config.return_value = None
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_manager):
            from virtual_team.routers.system_team import get_agent_config
            with pytest.raises(HTTPException) as exc:
                await get_agent_config("bad")
            assert exc.value.status_code == 404


class TestSystemTeamListAgentTools:
    async def test_success(self):
        mock_manager = MagicMock()
        mock_manager.get_agent_tools.return_value = [{"name": "tool1"}]
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_manager):
            from virtual_team.routers.system_team import list_agent_tools
            result = await list_agent_tools("agent-1")
            assert len(result) == 1


class TestSystemTeamListAgentSkills:
    async def test_success(self):
        mock_manager = MagicMock()
        mock_manager.get_agent_skills.return_value = [{"name": "skill1"}]
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_manager):
            from virtual_team.routers.system_team import list_agent_skills
            result = await list_agent_skills("agent-1")
            assert len(result) == 1


class TestSystemTeamListSharedResources:
    async def test_success(self):
        mock_manager = MagicMock()
        mock_manager.get_shared_resources.return_value = {"resources": []}
        with patch("virtual_team.routers.system_team.get_system_team_manager", return_value=mock_manager):
            from virtual_team.routers.system_team import list_shared_resources
            result = await list_shared_resources()
            assert "resources" in result


class TestSystemTeamGetLlmStatus:
    async def test_available(self):
        with patch("virtual_team.routers.system_team.llm_client") as mock_client:
            mock_client.is_available.return_value = True
            from virtual_team.routers.system_team import get_llm_status
            result = await get_llm_status()
            assert result["available"] is True

    async def test_unavailable(self):
        with patch("virtual_team.routers.system_team.llm_client") as mock_client:
            mock_client.is_available.return_value = False
            from virtual_team.routers.system_team import get_llm_status
            result = await get_llm_status()
            assert result["available"] is False


class TestSystemTeamGenerateTool:
    async def test_success(self):
        from virtual_team.routers.system_team import ToolGenerateRequest
        tool_req = ToolGenerateRequest(description="test tool")
        with (
            patch("virtual_team.routers.system_team.tool_generator") as mock_gen,
        ):
            mock_gen.generate_with_llm = AsyncMock(return_value={"name": "test_tool", "code": "..."})
            from virtual_team.routers.system_team import generate_tool
            result = await generate_tool(tool_req)
            assert result["name"] == "test_tool"

    async def test_error_500(self):
        from virtual_team.routers.system_team import ToolGenerateRequest
        tool_req = ToolGenerateRequest(description="test tool")
        with patch("virtual_team.routers.system_team.tool_generator") as mock_gen:
            mock_gen.generate_with_llm = AsyncMock(side_effect=Exception("gen error"))
            from virtual_team.routers.system_team import generate_tool
            with pytest.raises(HTTPException) as exc:
                await generate_tool(tool_req)
            assert exc.value.status_code == 500


class TestSystemTeamSaveTool:
    async def test_success(self):
        mock_gen = MagicMock()
        mock_gen.save_tool.return_value = Path("/tmp/tool.py")
        with patch("virtual_team.routers.system_team.tool_generator", mock_gen):
            from virtual_team.routers.system_team import save_tool
            result = await save_tool({"name": "test"})
            assert result["success"] is True

    async def test_error_500(self):
        mock_gen = MagicMock()
        mock_gen.save_tool.side_effect = Exception("save error")
        with patch("virtual_team.routers.system_team.tool_generator", mock_gen):
            from virtual_team.routers.system_team import save_tool
            with pytest.raises(HTTPException) as exc:
                await save_tool({"name": "test"})
            assert exc.value.status_code == 500


class TestSystemTeamGenerateSkill:
    async def test_success(self):
        from virtual_team.routers.system_team import SkillGenerateRequest
        skill_req = SkillGenerateRequest(description="test skill")
        with patch("virtual_team.routers.system_team.skill_generator") as mock_gen:
            mock_gen.generate.return_value = {"name": "test_skill"}
            from virtual_team.routers.system_team import generate_skill
            result = await generate_skill(skill_req)
            assert result["name"] == "test_skill"

    async def test_error_500(self):
        from virtual_team.routers.system_team import SkillGenerateRequest
        skill_req = SkillGenerateRequest(description="test skill")
        with patch("virtual_team.routers.system_team.skill_generator") as mock_gen:
            mock_gen.generate.side_effect = Exception("gen error")
            from virtual_team.routers.system_team import generate_skill
            with pytest.raises(HTTPException) as exc:
                await generate_skill(skill_req)
            assert exc.value.status_code == 500


class TestSystemTeamSaveSkill:
    async def test_success(self):
        mock_gen = MagicMock()
        mock_gen.save_skill.return_value = Path("/tmp/skill.md")
        with patch("virtual_team.routers.system_team.skill_generator", mock_gen):
            from virtual_team.routers.system_team import save_skill
            result = await save_skill({"name": "test"})
            assert result["success"] is True

    async def test_error_500(self):
        mock_gen = MagicMock()
        mock_gen.save_skill.side_effect = Exception("save error")
        with patch("virtual_team.routers.system_team.skill_generator", mock_gen):
            from virtual_team.routers.system_team import save_skill
            with pytest.raises(HTTPException) as exc:
                await save_skill({"name": "test"})
            assert exc.value.status_code == 500


# ============================================================
# teams.py
# ============================================================

class TestListTeams:
    async def test_success(self):
        req = _mock_request()
        mock_teams = [
            {"id": "t1", "name": "Team A", "order": 1, "is_expanded": True, "agents": [], "created_at": None}
        ]
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.get_teams", new_callable=AsyncMock, return_value=mock_teams),
        ):
            from virtual_team.routers.teams import list_teams
            result = await list_teams(req)
            assert len(result) == 1
            assert result[0]["id"] == "t1"

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.get_teams", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.teams import list_teams
            with pytest.raises(HTTPException) as exc:
                await list_teams(req)
            assert exc.value.status_code == 500


class TestAddTeam:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.teams import TeamCreateRequest
        t_req = TeamCreateRequest(name="Team A")
        mock_team = MagicMock()
        mock_team.id = "t1"
        mock_team.name = "Team A"
        mock_team.order = 0
        mock_team.is_expanded = False
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.create_team", new_callable=AsyncMock, return_value=mock_team),
        ):
            from virtual_team.routers.teams import add_team
            result = await add_team(t_req, req)
            assert result["id"] == "t1"
            assert result["agents"] == []

    async def test_error_500(self):
        req = _mock_request()
        from virtual_team.routers.teams import TeamCreateRequest
        t_req = TeamCreateRequest(name="Team A")
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.create_team", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.teams import add_team
            with pytest.raises(HTTPException) as exc:
                await add_team(t_req, req)
            assert exc.value.status_code == 500


class TestGetTeamDetail:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.get_team", new_callable=AsyncMock, return_value={"id": "t1", "name": "Team A"}),
        ):
            from virtual_team.routers.teams import get_team_detail
            result = await get_team_detail("t1", req)
            assert result["id"] == "t1"

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.get_team", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.teams import get_team_detail
            with pytest.raises(HTTPException) as exc:
                await get_team_detail("t1", req)
            assert exc.value.status_code == 404


class TestUpdateTeam:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.teams import TeamUpdateRequest
        t_req = TeamUpdateRequest(name="Updated")
        mock_team = MagicMock()
        mock_team.id = "t1"
        mock_team.name = "Updated"
        mock_team.order = 1
        mock_team.is_expanded = False
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.update_team", new_callable=AsyncMock, return_value=mock_team),
        ):
            from virtual_team.routers.teams import update_team_endpoint
            result = await update_team_endpoint("t1", t_req, req)
            assert result["id"] == "t1"

    async def test_not_found_404(self):
        req = _mock_request()
        from virtual_team.routers.teams import TeamUpdateRequest
        t_req = TeamUpdateRequest(name="Updated")
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.update_team", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.teams import update_team_endpoint
            with pytest.raises(HTTPException) as exc:
                await update_team_endpoint("t1", t_req, req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        from virtual_team.routers.teams import TeamUpdateRequest
        t_req = TeamUpdateRequest(name="Updated")
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.update_team", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.teams import update_team_endpoint
            with pytest.raises(HTTPException) as exc:
                await update_team_endpoint("t1", t_req, req)
            assert exc.value.status_code == 500


class TestDeleteTeam:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.delete_team", new_callable=AsyncMock, return_value=True),
        ):
            from virtual_team.routers.teams import delete_team_endpoint
            result = await delete_team_endpoint("t1", req)
            assert result == {"ok": True}

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.delete_team", new_callable=AsyncMock, return_value=False),
        ):
            from virtual_team.routers.teams import delete_team_endpoint
            with pytest.raises(HTTPException) as exc:
                await delete_team_endpoint("t1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.delete_team", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.teams import delete_team_endpoint
            with pytest.raises(HTTPException) as exc:
                await delete_team_endpoint("t1", req)
            assert exc.value.status_code == 500


class TestAddMember:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.teams import MemberAddRequest
        m_req = MemberAddRequest(name="John")
        mock_member = {"id": "m1", "name": "John", "role": "待配置角色"}
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.add_team_member", new_callable=AsyncMock, return_value=mock_member),
        ):
            from virtual_team.routers.teams import add_member
            result = await add_member("t1", m_req, req)
            assert result["name"] == "John"

    async def test_team_not_found_404(self):
        req = _mock_request()
        from virtual_team.routers.teams import MemberAddRequest
        m_req = MemberAddRequest(name="John")
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.add_team_member", new_callable=AsyncMock, return_value=None),
        ):
            from virtual_team.routers.teams import add_member
            with pytest.raises(HTTPException) as exc:
                await add_member("t1", m_req, req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        from virtual_team.routers.teams import MemberAddRequest
        m_req = MemberAddRequest(name="John")
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.add_team_member", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.teams import add_member
            with pytest.raises(HTTPException) as exc:
                await add_member("t1", m_req, req)
            assert exc.value.status_code == 500


class TestRemoveMember:
    async def test_success(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.remove_team_member", new_callable=AsyncMock, return_value=True),
        ):
            from virtual_team.routers.teams import remove_member
            result = await remove_member("t1", "m1", req)
            assert result == {"ok": True}

    async def test_not_found_404(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.remove_team_member", new_callable=AsyncMock, return_value=False),
        ):
            from virtual_team.routers.teams import remove_member
            with pytest.raises(HTTPException) as exc:
                await remove_member("t1", "m1", req)
            assert exc.value.status_code == 404

    async def test_error_500(self):
        req = _mock_request()
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.remove_team_member", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.teams import remove_member
            with pytest.raises(HTTPException) as exc:
                await remove_member("t1", "m1", req)
            assert exc.value.status_code == 500


class TestReorderMembers:
    async def test_success(self):
        req = _mock_request()
        from virtual_team.routers.teams import ReorderRequest
        r_req = ReorderRequest(member_ids=["m1", "m2"])
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.reorder_team_members", new_callable=AsyncMock),
        ):
            from virtual_team.routers.teams import reorder_members
            result = await reorder_members("t1", r_req, req)
            assert result == {"ok": True}

    async def test_error_500(self):
        req = _mock_request()
        from virtual_team.routers.teams import ReorderRequest
        r_req = ReorderRequest(member_ids=["m1", "m2"])
        with (
            patch("virtual_team.routers.teams.get_user_id", return_value="user-1"),
            patch("virtual_team.routers.teams.reorder_team_members", new_callable=AsyncMock, side_effect=Exception("db error")),
        ):
            from virtual_team.routers.teams import reorder_members
            with pytest.raises(HTTPException) as exc:
                await reorder_members("t1", r_req, req)
            assert exc.value.status_code == 500


# ============================================================
# tools.py
# ============================================================

class TestGenerateToolFromDescription:
    def test_python_read_file(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("读取文件内容", "python")
        assert result.name == "read_file"
        assert result.is_valid is True

    def test_python_write_file(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("保存内容", "python")
        assert result.name == "write_file"

    def test_python_search_code(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("搜索代码中的内容", "python")
        assert result.name == "search_code"

    def test_python_run_command(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("执行Shell命令", "python")
        assert result.name == "run_command"

    def test_python_http_request(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("发送HTTP API请求", "python")
        assert result.name == "http_request"

    def test_python_parse_json(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("解析JSON数据", "python")
        assert result.name == "parse_json"

    def test_python_weather(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("查询天气信息", "python")
        assert result.name == "get_weather"

    def test_python_database(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("查询SQL数据库", "python")
        assert result.name == "query_database"

    def test_python_custom_tool(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("一些自定义功能描述", "python")
        assert result.name == "custom_tool"

    def test_javascript_fallback(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("读取文件", "javascript")
        assert result.language == "javascript" or result.language == "python"
        assert result.is_valid is True

    def test_javascript_weather(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("查询天气", "javascript")
        assert result.is_valid is True
        assert "getWeather" in result.name or "weather" in result.name

    def test_english_keywords(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("read file tool", "python")
        assert result.name == "read_file"

    def test_js_keywords(self):
        from virtual_team.routers.tools import _generate_tool_from_description
        result = _generate_tool_from_description("save data", "javascript")
        assert result.is_valid is True


class TestValidateToolCode:
    def test_valid_python(self):
        from virtual_team.routers.tools import _validate_tool_code
        code = 'def foo():\n    """doc"""\n    import os\n    try:\n        pass\n    except:\n        pass'
        result = _validate_tool_code(code, "python")
        assert result.is_valid is True

    def test_python_missing_def(self):
        from virtual_team.routers.tools import _validate_tool_code
        result = _validate_tool_code("x = 1", "python")
        assert "函数定义" in str(result.suggestions)

    def test_python_missing_docstring(self):
        from virtual_team.routers.tools import _validate_tool_code
        result = _validate_tool_code("def foo():\n    pass", "python")
        assert "文档字符串" in str(result.suggestions)

    def test_python_missing_try(self):
        from virtual_team.routers.tools import _validate_tool_code
        code = 'def foo():\n    """doc"""\n    pass'
        result = _validate_tool_code(code, "python")
        assert "异常处理" in str(result.suggestions)

    def test_valid_javascript(self):
        from virtual_team.routers.tools import _validate_tool_code
        code = '/** doc */ function foo() { try { } catch(e) { } }'
        result = _validate_tool_code(code, "javascript")
        assert result.is_valid is True

    def test_javascript_missing_function(self):
        from virtual_team.routers.tools import _validate_tool_code
        result = _validate_tool_code("var x = 1;", "javascript")
        assert "函数定义" in str(result.suggestions)

    def test_typescript_valid(self):
        from virtual_team.routers.tools import _validate_tool_code
        code = 'function foo(): void { try { } catch(e) { } }'
        result = _validate_tool_code(code, "typescript")
        assert "建议" in str(result.suggestions) or result.is_valid is True


class TestExecuteToolSandbox:
    def test_python_valid_syntax(self):
        from virtual_team.routers.tools import _execute_tool_sandbox
        result = _execute_tool_sandbox("x = 1", "python")
        assert "语法检查通过" in result

    def test_python_syntax_error(self):
        from virtual_team.routers.tools import _execute_tool_sandbox
        with pytest.raises(Exception) as exc:
            _execute_tool_sandbox("x = ", "python")
        assert "语法错误" in str(exc.value)

    def test_python_runtime_error(self):
        from virtual_team.routers.tools import _execute_tool_sandbox
        with pytest.raises(Exception) as exc:
            _execute_tool_sandbox("raise ValueError('bad')", "python")
        assert "执行错误" in str(exc.value)

    def test_javascript(self):
        from virtual_team.routers.tools import _execute_tool_sandbox
        result = _execute_tool_sandbox("var x = 1;", "javascript")
        assert "Node.js" in result


class TestGenerateTool:
    async def test_success(self):
        from virtual_team.routers.tools import ToolGenerateRequest
        tool_req = ToolGenerateRequest(description="读取文件")
        from virtual_team.routers.tools import generate_tool
        result = await generate_tool(tool_req)
        assert result.name == "read_file"
        assert result.is_valid is True

    async def test_error_500(self):
        from virtual_team.routers.tools import ToolGenerateRequest
        tool_req = ToolGenerateRequest(description="读取文件")
        with patch("virtual_team.routers.tools._generate_tool_from_description", side_effect=Exception("gen error")):
            from virtual_team.routers.tools import generate_tool
            with pytest.raises(HTTPException) as exc:
                await generate_tool(tool_req)
            assert exc.value.status_code == 500


class TestValidateTool:
    async def test_success(self):
        from virtual_team.routers.tools import ToolValidateRequest
        val_req = ToolValidateRequest(code='def foo():\n    """doc"""\n    pass', language="python")
        from virtual_team.routers.tools import validate_tool
        result = await validate_tool(val_req)
        assert result.is_valid is not None

    async def test_error_500(self):
        from virtual_team.routers.tools import ToolValidateRequest
        val_req = ToolValidateRequest(code="bad code", language="python")
        with patch("virtual_team.routers.tools._validate_tool_code", side_effect=Exception("val error")):
            from virtual_team.routers.tools import validate_tool
            with pytest.raises(HTTPException) as exc:
                await validate_tool(val_req)
            assert exc.value.status_code == 500


class TestExecuteTool:
    async def test_success(self):
        from virtual_team.routers.tools import execute_tool
        result = await execute_tool("x = 1", "python")
        assert result["success"] is True
        assert "output" in result

    async def test_error_response(self):
        from virtual_team.routers.tools import execute_tool
        result = await execute_tool("x = ", "python")
        assert result["success"] is False
        assert "error" in result

    async def test_javascript(self):
        from virtual_team.routers.tools import execute_tool
        result = await execute_tool("var x = 1;", "javascript")
        assert result["success"] is True
        assert "output" in result
