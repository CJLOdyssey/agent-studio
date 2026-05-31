import pytest

from virtual_team.agents import (
    create_agent_from_config,
    create_user_proxy,
    is_termination_msg,
)
from virtual_team.config import TeamConfig
from virtual_team.models import AgentConfig
from virtual_team.prompts import APPROVAL_KEYWORD, DIRECT_REPLY_KEYWORD


@pytest.fixture
def config():
    return TeamConfig(api_key="sk-test")


@pytest.fixture
def frontend_config():
    return AgentConfig(
        name="前端工程师",
        role_identifier="frontend",
        system_prompt="你是前端工程师，负责界面设计。",
        order=0,
        icon="🎨",
    )


@pytest.fixture
def backend_config():
    return AgentConfig(
        name="后端工程师",
        role_identifier="backend",
        system_prompt="你是后端工程师，负责 API 实现。",
        order=1,
        icon="⚙️",
    )


class TestCreateAgentFromConfig:
    def test_creates_agent_with_correct_name(self, config, frontend_config):
        agent = create_agent_from_config(frontend_config, config)
        assert agent.name == "frontend"

    def test_creates_agent_with_system_prompt(self, config, frontend_config):
        agent = create_agent_from_config(frontend_config, config)
        assert "前端工程师" in agent.system_message

    def test_creates_agent_inherits_global_model(self, config, frontend_config):
        agent = create_agent_from_config(frontend_config, config)
        assert agent.llm_config["config_list"][0]["model"] == "gpt-4o"

    def test_creates_agent_with_custom_model(self, config, frontend_config):
        frontend_config.model = "deepseek-v4-flash"
        agent = create_agent_from_config(frontend_config, config)
        assert agent.llm_config["config_list"][0]["model"] == "deepseek-v4-flash"

    def test_creates_agent_with_custom_temperature(self, config, frontend_config):
        frontend_config.temperature = 0.1
        agent = create_agent_from_config(frontend_config, config)
        assert agent.llm_config["temperature"] == 0.1


class TestCreateUserProxy:
    def test_creates_user_proxy(self, config):
        proxy = create_user_proxy(config)
        assert proxy.name == "UserProxy"

    def test_human_input_never(self, config):
        proxy = create_user_proxy(config)
        assert proxy.human_input_mode == "NEVER"


class TestIsTerminationMsg:
    def test_approval_keyword_triggers_termination(self):
        assert is_termination_msg({"content": f"代码通过{APPROVAL_KEYWORD}"}) is True

    def test_approval_keyword_in_long_text(self):
        assert is_termination_msg({"content": f"审查完毕\n{APPROVAL_KEYWORD}\n结束"}) is True

    def test_no_approval_keyword(self):
        assert is_termination_msg({"content": "代码还需要修改"}) is False

    def test_empty_content(self):
        assert is_termination_msg({"content": ""}) is False

    def test_none_content(self):
        assert is_termination_msg({"content": None}) is False

    def test_no_content_key(self):
        assert is_termination_msg({}) is False

    def test_direct_reply_keyword_triggers_termination(self):
        assert is_termination_msg({"content": f"你好！{DIRECT_REPLY_KEYWORD}"}) is True

    def test_direct_reply_keyword_in_sentence(self):
        assert is_termination_msg({"content": f"不客气，有需要再找我。{DIRECT_REPLY_KEYWORD}"}) is True

    def test_direct_reply_without_keyword(self):
        assert is_termination_msg({"content": "很高兴为您服务"}) is False
