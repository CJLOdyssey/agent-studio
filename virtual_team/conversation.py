import logging
import threading
import time

from autogen import GroupChat, GroupChatManager

from virtual_team.agents import create_agent_from_config, create_user_proxy
from virtual_team.config import TeamConfig
from virtual_team.extractors import extract_all
from virtual_team.models import (
    AgentConfig,
    ConversationRound,
    ConversationStatus,
    Message,
    TeamOutput,
)
from virtual_team.prompts import APPROVAL_KEYWORD, DIRECT_REPLY_KEYWORD

logger = logging.getLogger(__name__)


class TeamManager:
    def __init__(
        self,
        config: TeamConfig,
        agent_configs: list[AgentConfig],
        message_callback=None,
    ):
        self.config = config
        self.status = ConversationStatus.IN_PROGRESS
        self.message_callback = message_callback
        self._agent_configs = agent_configs

        self._user_proxy = create_user_proxy(config)
        self._agents = []
        for ac in agent_configs:
            agent = create_agent_from_config(ac, config)
            self._agents.append(agent)

        # Find approver agents (for termination check)
        self._approver_identifiers = {
            ac.role_identifier for ac in agent_configs if ac.is_approver
        }

        self._groupchat = GroupChat(
            agents=[self._user_proxy] + self._agents,
            messages=[],
            max_round=config.max_rounds * len(self._agents) + 5,
            speaker_selection_method=self._select_speaker,
        )
        self._manager = GroupChatManager(
            groupchat=self._groupchat,
            llm_config=config.build_llm_config(),
            is_termination_msg=lambda msg: (APPROVAL_KEYWORD in (msg.get("content", "") or "")
                                            or DIRECT_REPLY_KEYWORD in (msg.get("content", "") or "")),
        )

    def _select_speaker(self, last_speaker, groupchat):
        agents = self._agents
        messages = groupchat.messages
        num_messages = len(messages)
        if num_messages <= 1 or last_speaker.name == "UserProxy":
            speaker = agents[0]
            logger.debug("Selecting speaker: %s (first)", speaker.name)
            return speaker

        last_name = last_speaker.name

        # Check if the last speaker is an approver who just approved
        if last_name in self._approver_identifiers:
            last_content = messages[-1].get("content", "") or ""
            if APPROVAL_KEYWORD in last_content:
                logger.debug("Terminating: approver %s issued approval", last_name)
                return None

        # Find the current speaker's position in the order
        try:
            last_idx = next(i for i, a in enumerate(agents) if a.name == last_name)
        except StopIteration:
            return agents[0]

        next_idx = (last_idx + 1) % len(agents)
        next_agent = agents[next_idx]

        logger.debug("Selecting speaker: %s (round-robin from %s)", next_agent.name, last_name)
        return next_agent

    def _build_output_from_messages(
        self, requirement: str, raw_messages: list[dict]
    ) -> TeamOutput:
        our_messages = []
        round_counter = 1
        # Map agent names to configs for display
        name_to_config = {ac.role_identifier: ac for ac in self._agent_configs}

        for msg in raw_messages:
            name = msg.get("name", "")
            content = msg.get("content", "") or ""
            if name == "UserProxy" or not name or not content:
                continue
            our_messages.append(
                Message(role=name, content=content, round_number=round_counter)
            )
            round_counter += 1

        extracted = extract_all(our_messages)
        approved = APPROVAL_KEYWORD in str(raw_messages)
        self.status = (
            ConversationStatus.CONVERGED
            if approved
            else ConversationStatus.MAX_ROUNDS_REACHED
        )
        max_round = max(m.round_number for m in our_messages) if our_messages else 0
        rounds = [
            ConversationRound(
                round_number=i + 1,
                messages=[m for m in our_messages if m.round_number == i + 1],
            )
            for i in range(max_round)
        ]
        return TeamOutput(
            requirement=requirement,
            pm_document=extracted["pm_document"],
            code=extracted["code"],
            review=extracted["review"],
            approved=approved,
            conversation_rounds=rounds,
        )

    def run(self, requirement: str) -> TeamOutput:
        self.status = ConversationStatus.IN_PROGRESS
        self._groupchat.messages.clear()
        logger.info(
            "Starting team discussion | requirement=%.200s | agents=%d | max_rounds=%d",
            requirement, len(self._agents), self.config.max_rounds,
        )
        try:
            self._user_proxy.initiate_chat(
                self._manager,
                message=f"用户需求：{requirement}",
                clear_history=False,
            )
        except Exception as e:
            logger.error("Discussion failed: %s", e, exc_info=True)
            self.status = ConversationStatus.ERROR
            raise

        return self._build_output_from_messages(requirement, self._groupchat.messages)

    def run_streaming(self, requirement: str) -> TeamOutput:
        self.status = ConversationStatus.IN_PROGRESS
        self._groupchat.messages.clear()
        logger.info(
            "Starting streaming discussion | requirement=%.200s | agents=%d",
            requirement, len(self._agents),
        )

        def run_chat():
            try:
                self._user_proxy.initiate_chat(
                    self._manager,
                    message=f"用户需求：{requirement}",
                    clear_history=False,
                )
            except Exception as e:
                logger.error("Streaming discussion failed: %s", e, exc_info=True)
                self.status = ConversationStatus.ERROR

        thread = threading.Thread(target=run_chat, daemon=True)
        thread.start()

        # Poll for completion
        while thread.is_alive():
            if self.message_callback:
                for msg in self._groupchat.messages:
                    name = msg.get("name", "")
                    content = msg.get("content", "") or ""
                    if name and content and name != "UserProxy":
                        self.message_callback(msg)
            time.sleep(0.5)

        # Final flush
        if self.message_callback:
            for msg in self._groupchat.messages:
                name = msg.get("name", "")
                content = msg.get("content", "") or ""
                if name and content and name != "UserProxy":
                    self.message_callback(msg)

        if self.status != ConversationStatus.ERROR:
            return self._build_output_from_messages(requirement, self._groupchat.messages)
        raise RuntimeError("Team discussion failed")
