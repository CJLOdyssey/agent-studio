"""Command palette API routes."""

import json
from typing import Any

from fastapi import APIRouter

from virtual_team.error_codes import ErrorCode, error_response
from virtual_team.logging_config import get_logger
from virtual_team.models import CommandExecuteRequest, CommandExecuteResponse, CommandResponse
from virtual_team.repository import get_session, log_command, update_session_title

logger = get_logger(__name__)
router = APIRouter(tags=["commands"])


BUILTIN_COMMANDS: list[dict[str, Any]] = [
    {
        "id": "clear",
        "name": "清空对话",
        "description": "清空当前会话的对话历史",
        "category": "session",
        "shortcut": "Ctrl+L",
    },
    {
        "id": "export",
        "name": "导出对话",
        "description": "导出当前对话为 Markdown 文件",
        "category": "session",
        "shortcut": "Ctrl+E",
    },
    {
        "id": "rename",
        "name": "重命名对话",
        "description": "修改当前对话的标题",
        "category": "session",
        "requires_input": True,
    },
    {
        "id": "model",
        "name": "切换模型",
        "description": "打开 AI 模型选择面板",
        "category": "settings",
    },
    {
        "id": "agents",
        "name": "管理 Agent",
        "description": "打开 Agent 配置管理面板",
        "category": "settings",
    },
    {
        "id": "help",
        "name": "帮助",
        "description": "显示可用命令和快捷键",
        "category": "general",
        "shortcut": "?",
    },
    {
        "id": "shortcuts",
        "name": "键盘快捷键",
        "description": "显示所有键盘快捷键",
        "category": "general",
    },
]


@router.get("/api/commands", response_model=list[CommandResponse])
async def list_commands() -> Any:
    return [
        CommandResponse(
            id=cmd["id"],
            name=cmd["name"],
            description=cmd["description"],
            shortcut=cmd.get("shortcut"),
            category=cmd.get("category", "general"),
            requires_input=cmd.get("requires_input", False),
            enabled=True,
        )
        for cmd in BUILTIN_COMMANDS
    ]


@router.get("/api/commands/{command_id}", response_model=CommandResponse)
async def get_command(command_id: str) -> Any:
    for cmd in BUILTIN_COMMANDS:
        if cmd["id"] == command_id:
            return CommandResponse(
                id=cmd["id"],
                name=cmd["name"],
                description=cmd["description"],
                shortcut=cmd.get("shortcut"),
                category=cmd.get("category", "general"),
                requires_input=cmd.get("requires_input", False),
                enabled=True,
            )
    raise error_response(ErrorCode.COMMAND_NOT_FOUND, detail=f"未找到命令: {command_id}")


@router.post("/api/commands/execute", response_model=CommandExecuteResponse)
async def execute_command(req: CommandExecuteRequest) -> Any:
    cmd = next((c for c in BUILTIN_COMMANDS if c["id"] == req.command_id), None)
    if cmd is None:
        raise error_response(ErrorCode.COMMAND_NOT_FOUND, detail=f"未知命令: {req.command_id}")

    sess = await get_session(req.session_id)
    if sess is None:
        raise error_response(ErrorCode.SESSION_NOT_FOUND, detail="会话不存在")

    result = await _dispatch_command(cmd["id"], req.session_id, req.payload)

    await log_command(
        session_id=req.session_id,
        command_id=cmd["id"],
        command_name=cmd["name"],
        payload=json.dumps(req.payload, ensure_ascii=False),
        result=json.dumps(result.data, ensure_ascii=False),
    )

    logger.info("Command executed | id=%s | session=%s", cmd["id"], req.session_id)
    return result


async def _dispatch_command(
    command_id: str, session_id: str, payload: dict[str, Any]
) -> CommandExecuteResponse:
    if command_id == "clear":
        return CommandExecuteResponse(
            success=True,
            message="对话已清空",
            data={"action": "clear_conversation", "session_id": session_id},
        )

    if command_id == "export":
        return CommandExecuteResponse(
            success=True,
            message="对话已导出",
            data={"action": "export_conversation", "session_id": session_id, "format": "markdown"},
        )

    if command_id == "rename":
        new_title = payload.get("title", "").strip()
        if not new_title:
            return CommandExecuteResponse(success=False, message="标题不能为空", data={})
        if len(new_title) > 256:
            return CommandExecuteResponse(success=False, message="标题过长(最多256字符)", data={})
        try:
            await update_session_title(session_id, new_title)
            return CommandExecuteResponse(
                success=True,
                message="对话已重命名",
                data={"action": "rename_session", "session_id": session_id, "new_title": new_title},
            )
        except Exception as e:
            logger.error("Rename failed: %s", e, exc_info=True)
            return CommandExecuteResponse(success=False, message=f"重命名失败: {e}", data={})

    if command_id == "model":
        return CommandExecuteResponse(
            success=True,
            message="请在前端打开模型选择",
            data={"action": "open_settings", "panel": "model"},
        )

    if command_id == "agents":
        return CommandExecuteResponse(
            success=True,
            message="请在前端打开 Agent 管理",
            data={"action": "open_settings", "panel": "agents"},
        )

    if command_id == "help":
        return CommandExecuteResponse(
            success=True,
            message="帮助信息",
            data={"action": "show_help", "commands": BUILTIN_COMMANDS},
        )

    if command_id == "shortcuts":
        shortcuts = [
            {"keys": "Ctrl+L", "action": "清空对话"},
            {"keys": "Ctrl+E", "action": "导出对话"},
            {"keys": "Ctrl+K", "action": "打开命令面板"},
            {"keys": "/", "action": "快速打开命令面板"},
            {"keys": "Enter", "action": "发送消息"},
            {"keys": "Shift+Enter", "action": "换行"},
            {"keys": "Ctrl+Enter", "action": "发送消息(替代)"},
        ]
        return CommandExecuteResponse(
            success=True,
            message="快捷键列表",
            data={"action": "show_shortcuts", "shortcuts": shortcuts},
        )

    return CommandExecuteResponse(
        success=False,
        message=f"命令 {command_id} 尚未实现",
        data={},
    )
