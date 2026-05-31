from autogen import AssistantAgent, UserProxyAgent

from virtual_team.config import TeamConfig
from virtual_team.models import AgentConfig
from virtual_team.prompts import APPROVAL_KEYWORD, DIRECT_REPLY_KEYWORD


def is_termination_msg(msg: dict) -> bool:
    content = msg.get("content", "") or ""
    return APPROVAL_KEYWORD in content or DIRECT_REPLY_KEYWORD in content


def create_agent_from_config(agent_cfg: AgentConfig, team_config: TeamConfig) -> AssistantAgent:
    llm_config = team_config.build_llm_config()
    if agent_cfg.model:
        llm_config["config_list"][0]["model"] = agent_cfg.model
    if agent_cfg.temperature is not None:
        llm_config["temperature"] = agent_cfg.temperature

    return AssistantAgent(
        name=agent_cfg.role_identifier,
        system_message=agent_cfg.system_prompt,
        llm_config=llm_config,
        is_termination_msg=is_termination_msg,
    )


def create_user_proxy(config: TeamConfig) -> UserProxyAgent:
    return UserProxyAgent(
        name="UserProxy",
        human_input_mode="NEVER",
        code_execution_config=False,
        llm_config=False,
        is_termination_msg=is_termination_msg,
    )
