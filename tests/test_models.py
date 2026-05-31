from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from virtual_team.models import (
    AgentConfig,
    ConversationRound,
    ConversationStatus,
    Message,
    Role,
    TeamOutput,
)


class TestRole:
    def test_role_values(self):
        assert Role.PM.value == "pm"
        assert Role.PROGRAMMER.value == "programmer"
        assert Role.TESTER.value == "tester"

    def test_role_display_names(self):
        assert Role.PM.display_name == "产品经理"
        assert Role.PROGRAMMER.display_name == "资深程序员"
        assert Role.TESTER.display_name == "测试工程师"


class TestAgentConfig:
    def test_create_agent_config(self):
        cfg = AgentConfig(
            name="前端工程师",
            role_identifier="frontend",
            system_prompt="你是前端工程师。",
            order=0,
        )
        assert cfg.name == "前端工程师"
        assert cfg.role_identifier == "frontend"
        assert cfg.is_active is True
        assert cfg.is_approver is False
        assert cfg.icon == "🤖"
        assert cfg.order == 0

    def test_create_approver(self):
        cfg = AgentConfig(
            name="测试工程师",
            role_identifier="tester",
            system_prompt="测试。",
            order=1,
            is_approver=True,
            icon="🧪",
        )
        assert cfg.is_approver is True
        assert cfg.icon == "🧪"

    def test_agent_config_with_model(self):
        cfg = AgentConfig(
            name="后端",
            role_identifier="backend",
            system_prompt="后端。",
            order=0,
            model="deepseek-v4-flash",
            temperature=0.3,
        )
        assert cfg.model == "deepseek-v4-flash"
        assert cfg.temperature == 0.3

    def test_role_identifier_must_be_lowercase(self):
        with pytest.raises(ValidationError):
            AgentConfig(
                name="Bad",
                role_identifier="FrontEnd",
                system_prompt="test",
                order=0,
            )

    def test_role_identifier_no_spaces(self):
        with pytest.raises(ValidationError):
            AgentConfig(
                name="Bad",
                role_identifier="front end",
                system_prompt="test",
                order=0,
            )

    def test_empty_name_raises(self):
        with pytest.raises(ValidationError):
            AgentConfig(
                name="",
                role_identifier="test",
                system_prompt="test",
                order=0,
            )

    def test_empty_system_prompt_raises(self):
        with pytest.raises(ValidationError):
            AgentConfig(
                name="Test",
                role_identifier="test",
                system_prompt="",
                order=0,
            )

    def test_temperature_out_of_range(self):
        with pytest.raises(ValidationError):
            AgentConfig(
                name="Test",
                role_identifier="test",
                system_prompt="test",
                order=0,
                temperature=2.0,
            )


class TestMessage:
    def test_message_creation(self):
        msg = Message(role="pm", content="这是产品需求文档")
        assert msg.role == "pm"
        assert msg.content == "这是产品需求文档"
        assert isinstance(msg.timestamp, datetime)
        assert msg.round_number == 1

    def test_message_custom_round(self):
        msg = Message(role="programmer", content="代码实现", round_number=3)
        assert msg.round_number == 3

    def test_message_empty_content_raises(self):
        with pytest.raises(ValidationError):
            Message(role="pm", content="")

    def test_message_whitespace_only_raises(self):
        with pytest.raises(ValidationError):
            Message(role="pm", content="   ")

    def test_message_any_role_string_accepted(self):
        msg = Message(role="custom_role_name", content="test")
        assert msg.role == "custom_role_name"

    def test_message_negative_round_raises(self):
        with pytest.raises(ValidationError):
            Message(role="pm", content="test", round_number=0)


class TestTeamOutput:
    def test_output_creation(self):
        output = TeamOutput(
            requirement="写一个贪吃蛇游戏",
            pm_document="## 需求文档\n贪吃蛇游戏",
            code="print('hello')",
            review="代码质量良好，建议添加注释",
            approved=True,
        )
        assert output.requirement == "写一个贪吃蛇游戏"
        assert output.approved is True
        assert isinstance(output.timestamp, datetime)

    def test_output_minimal(self):
        output = TeamOutput(
            requirement="计算器",
            pm_document="简易计算器",
            code="",
            review="",
            approved=False,
        )
        assert output.approved is False

    def test_output_empty_requirement_raises(self):
        with pytest.raises(ValidationError):
            TeamOutput(
                requirement="",
                pm_document="doc",
                code="",
                review="",
                approved=False,
            )


class TestConversationRound:
    def test_create_round(self):
        msgs = [Message(role="pm", content="文档", round_number=1)]
        round_ = ConversationRound(round_number=1, messages=msgs)
        assert round_.round_number == 1
        assert len(round_.messages) == 1

    def test_empty_messages_raises(self):
        with pytest.raises(ValidationError):
            ConversationRound(round_number=1, messages=[])

    def test_round_number_must_be_positive(self):
        with pytest.raises(ValidationError):
            ConversationRound(round_number=0, messages=[Message(role="pm", content="doc", round_number=1)])


class TestConversationStatus:
    def test_status_values(self):
        assert ConversationStatus.IN_PROGRESS.value == "in_progress"
        assert ConversationStatus.CONVERGED.value == "converged"
        assert ConversationStatus.MAX_ROUNDS_REACHED.value == "max_rounds_reached"
        assert ConversationStatus.ERROR.value == "error"
