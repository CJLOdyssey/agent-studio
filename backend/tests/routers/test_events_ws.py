"""Tests for the per-user event WebSocket channel (/api/ws/events)."""

import pytest
import starlette.websockets as ws_errors


async def _event_stream(*args: object, **kwargs: object):
    yield {"type": "session.deleted", "session_id": "s1", "ts": 1}


def test_user_events_ws_rejects_anonymous(client, monkeypatch):
    monkeypatch.setattr("routers.events._ws_user_id", lambda websocket: "")
    with client.websocket_connect("/api/ws/events") as websocket:
        assert websocket.receive_json() == {"type": "status", "status": "error", "error": "未登录"}
        with pytest.raises(ws_errors.WebSocketDisconnect) as exc_info:
            websocket.receive_json()
    assert exc_info.value.code == 1008


def test_user_events_ws_streams_user_events(client, monkeypatch):
    monkeypatch.setattr("routers.events._ws_user_id", lambda websocket: "u1")
    monkeypatch.setattr("routers.events.subscribe_user_events", _event_stream)
    with client.websocket_connect("/api/ws/events") as websocket:
        assert websocket.receive_json() == {"type": "status", "status": "connected"}
        assert websocket.receive_json() == {
            "type": "session.deleted",
            "session_id": "s1",
            "ts": 1,
        }


def test_ws_user_id_guest_when_auth_disabled(monkeypatch):
    from unittest.mock import MagicMock

    from routers.events import _ws_user_id

    monkeypatch.setattr("routers.events.auth_enabled", lambda: False)
    ws = MagicMock()
    assert _ws_user_id(ws) == "guest"


def test_ws_user_id_empty_without_token(monkeypatch):
    from unittest.mock import MagicMock

    from routers.events import _ws_user_id

    monkeypatch.setattr("routers.events.auth_enabled", lambda: True)
    ws = MagicMock()
    ws.cookies.get.return_value = None
    assert _ws_user_id(ws) == ""


def test_ws_user_id_from_token(monkeypatch):
    from unittest.mock import MagicMock

    from routers.events import _ws_user_id

    monkeypatch.setattr("routers.events.auth_enabled", lambda: True)
    monkeypatch.setattr("routers.events.decode_jwt", lambda token, secret: {"sub": "user-123"})
    ws = MagicMock()
    ws.cookies.get.return_value = "token"
    assert _ws_user_id(ws) == "user-123"


def test_ws_user_id_empty_on_invalid_payload(monkeypatch):
    from unittest.mock import MagicMock

    from routers.events import _ws_user_id

    monkeypatch.setattr("routers.events.auth_enabled", lambda: True)
    monkeypatch.setattr("routers.events.decode_jwt", lambda token, secret: None)
    ws = MagicMock()
    ws.cookies.get.return_value = "token"
    assert _ws_user_id(ws) == ""
