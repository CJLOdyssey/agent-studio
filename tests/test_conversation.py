import pytest

from virtual_team.config import TeamConfig
from virtual_team.conversation import TeamManager
from virtual_team.models import AgentConfig, ConversationStatus
from virtual_team.prompts import APPROVAL_KEYWORD


@pytest.fixture
def config():
    return TeamConfig(api_key="sk-test", max_rounds=3)


@pytest.fixture
def default_agents():
    return [
        AgentConfig(
            name="前端工程师",
            role_identifier="frontend",
            system_prompt="你是前端工程师。输出设计文档。",
            order=0,
            icon="🎨",
        ),
        AgentConfig(
            name="后端工程师",
            role_identifier="backend",
            system_prompt="你是后端工程师。输出代码。",
            order=1,
            icon="⚙️",
        ),
        AgentConfig(
            name="测试工程师",
            role_identifier="tester",
            system_prompt="你是测试工程师。审查代码，通过时输出【批准】。",
            order=2,
            is_approver=True,
            icon="🧪",
        ),
    ]


@pytest.fixture
def manager(config, default_agents):
    return TeamManager(config, default_agents)


class TestSpeakerSelection:
    def test_first_message_selects_first_agent(self, manager):
        gc = manager._groupchat
        gc.messages.clear()
        gc.messages.append({"content": "需求", "name": "UserProxy", "role": "user"})
        next_speaker = manager._select_speaker(
            manager._user_proxy, gc
        )
        assert next_speaker.name == "frontend"

    def test_after_first_agent_selects_second(self, manager):
        gc = manager._groupchat
        gc.messages.clear()
        gc.messages.append({"content": "需求", "name": "UserProxy", "role": "user"})
        gc.messages.append({"content": "设计文档", "name": "frontend", "role": "assistant"})
        next_speaker = manager._select_speaker(
            manager._agents[0], gc
        )
        assert next_speaker.name == "backend"

    def test_after_second_selects_third(self, manager):
        gc = manager._groupchat
        gc.messages.clear()
        gc.messages.append({"content": "需求", "name": "UserProxy", "role": "user"})
        gc.messages.append({"content": "doc", "name": "frontend", "role": "assistant"})
        gc.messages.append({"content": "code", "name": "backend", "role": "assistant"})
        next_speaker = manager._select_speaker(
            manager._agents[1], gc
        )
        assert next_speaker.name == "tester"

    def test_approver_sees_approval_keyword_terminates(self, manager):
        gc = manager._groupchat
        gc.messages.clear()
        gc.messages.append({"content": "需求", "name": "UserProxy", "role": "user"})
        gc.messages.append({"content": "doc", "name": "frontend", "role": "assistant"})
        gc.messages.append({"content": "code", "name": "backend", "role": "assistant"})
        gc.messages.append(
            {"content": f"好的{APPROVAL_KEYWORD}", "name": "tester", "role": "assistant"}
        )
        # Next speaker should be frontend again (round-robin), but approval terminates
        next_speaker = manager._select_speaker(
            manager._agents[2], gc
        )
        assert next_speaker is None

    def test_round_robin_wraps_around(self, manager):
        gc = manager._groupchat
        gc.messages.clear()
        gc.messages.append({"content": "需求", "name": "UserProxy", "role": "user"})
        gc.messages.append({"content": "doc", "name": "frontend", "role": "assistant"})
        gc.messages.append({"content": "code", "name": "backend", "role": "assistant"})
        gc.messages.append(
            {"content": "需要修改", "name": "tester", "role": "assistant"}
        )
        # After tester (no approval), wraps to frontend
        next_speaker = manager._select_speaker(
            manager._agents[2], gc
        )
        assert next_speaker.name == "frontend"

    def test_with_custom_two_agents(self, config):
        agents = [
            AgentConfig(
                name="设计师",
                role_identifier="designer",
                system_prompt="设计产品。",
                order=0,
            ),
            AgentConfig(
                name="审查员",
                role_identifier="reviewer",
                system_prompt="审查工作。",
                order=1,
                is_approver=True,
            ),
        ]
        m = TeamManager(config, agents)
        gc = m._groupchat
        gc.messages.clear()
        gc.messages.append({"content": "需求", "name": "UserProxy", "role": "user"})
        gc.messages.append({"content": "设计", "name": "designer", "role": "assistant"})
        next_speaker = m._select_speaker(
            m._agents[0], gc
        )
        assert next_speaker.name == "reviewer"


class TestBuildOutput:
    def test_output_contains_all_messages(self, manager):
        raw_messages = [
            {"content": "需求", "name": "UserProxy", "role": "user"},
            {"content": "设计文档", "name": "frontend", "role": "assistant"},
            {"content": "```python\nx=1\n```", "name": "backend", "role": "assistant"},
            {"content": f"通过{APPROVAL_KEYWORD}", "name": "tester", "role": "assistant"},
        ]
        output = manager._build_output_from_messages("测试需求", raw_messages)
        assert output.requirement == "测试需求"
        assert "设计文档" in output.pm_document
        assert "x=1" in output.code
        assert "通过" in output.review
        assert output.approved is True
        assert len(output.conversation_rounds) > 0

    def test_output_without_approval(self, manager):
        raw_messages = [
            {"content": "需求", "name": "UserProxy", "role": "user"},
            {"content": "设计", "name": "frontend", "role": "assistant"},
            {"content": "代码", "name": "backend", "role": "assistant"},
            {"content": "不通过，有问题", "name": "tester", "role": "assistant"},
        ]
        output = manager._build_output_from_messages("测试需求", raw_messages)
        assert output.approved is False

    def test_output_filters_userproxy(self, manager):
        raw_messages = [
            {"content": "需求", "name": "UserProxy", "role": "user"},
            {"content": "设计文档", "name": "frontend", "role": "assistant"},
        ]
        output = manager._build_output_from_messages("测试", raw_messages)
        # UserProxy should be filtered out
        rounds = output.conversation_rounds
        all_roles = [m.role for r in rounds for m in r.messages]
        assert "UserProxy" not in all_roles


class TestTeamManager:
    def test_agents_ordered_correctly(self, config, default_agents):
        m = TeamManager(config, default_agents)
        assert len(m._agents) == 3
        assert m._agents[0].name == "frontend"
        assert m._agents[1].name == "backend"
        assert m._agents[2].name == "tester"

    def test_approver_identifiers_set(self, config, default_agents):
        m = TeamManager(config, default_agents)
        assert "tester" in m._approver_identifiers

    def test_no_approver_does_not_crash(self, config):
        agents = [
            AgentConfig(
                name="普通成员",
                role_identifier="member",
                system_prompt="工作。",
                order=0,
                is_approver=False,
            ),
        ]
        m = TeamManager(config, agents)
        assert len(m._approver_identifiers) == 0
        gc = m._groupchat
        gc.messages.clear()
        gc.messages.append({"content": "需求", "name": "UserProxy", "role": "user"})
        gc.messages.append({"content": "工作内容", "name": "member", "role": "assistant"})
        speaker = m._select_speaker(m._agents[0], gc)
        assert speaker is not None
