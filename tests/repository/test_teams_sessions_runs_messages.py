"""Tests for teams.py, session_repo.py, run_repo.py, message_repo.py."""

import uuid

import pytest

from backend.repository.teams import (
    add_team_member,
    create_team,
    delete_team,
    get_team,
    get_teams,
    link_agent_config,
    remove_team_member,
    reorder_team_members,
    update_team,
)
from backend.repository.session_repo import (
    create_session,
    delete_session,
    get_session,
    get_sessions,
    update_session_title,
)
from backend.repository.run_repo import (
    create_run,
    get_run,
    get_runs,
    get_runs_by_session_ids,
    get_session_runs,
    update_run_result,
    update_run_status,
)
from backend.repository.message_repo import (
    get_messages,
    get_run_messages,
    get_session_messages,
    save_message,
)


# ── Team Tests ───────────────────────────────────────────────────────────


class TestTeamRepo:
    async def test_create_team(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        assert team is not None
        assert team.id is not None
        assert team.order >= 0
        assert team.is_expanded is False

    async def test_create_team_with_desc_and_status(self, db_engine):
        team = await create_team(
            name=f"team-{uuid.uuid4().hex[:6]}",
            description="Test desc",
            status="inactive",
        )
        assert team.description == "Test desc"
        assert team.status == "inactive"

    async def test_create_team_first_order_zero(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        assert team.order == 0

    async def test_create_team_incrementing_order(self, db_engine):
        await create_team(name=f"team1-{uuid.uuid4().hex[:6]}")
        team2 = await create_team(name=f"team2-{uuid.uuid4().hex[:6]}")
        assert team2.order == 1

    async def test_create_team_duplicate_name(self, db_engine):
        name = f"dup-{uuid.uuid4().hex[:6]}"
        first = await create_team(name=name)
        assert first is not None
        second = await create_team(name=name)
        assert second is None

    async def test_get_team(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        fetched = await get_team(team.id)
        assert fetched is not None
        assert fetched["id"] == team.id
        assert "agents" in fetched

    async def test_get_team_not_found(self, db_engine):
        result = await get_team(str(uuid.uuid4()))
        assert result is None

    async def test_get_teams(self, db_engine):
        await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        teams = await get_teams()
        assert len(teams) >= 1
        assert "agents" in teams[0]

    async def test_get_teams_filtered_by_user(self, db_engine):
        from backend.core.infra.database import TeamDB, get_session_factory

        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        factory = get_session_factory()
        async with factory() as session:
            from sqlalchemy import select
            result = await session.execute(select(TeamDB).where(TeamDB.id == team.id))
            t = result.scalar_one()
            t.owner_id = "owner-123"
            await session.commit()

        teams = await get_teams(user_id="owner-123")
        assert len(teams) >= 1

    async def test_update_team(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        updated = await update_team(team.id, name="New Name", description="Desc", status="paused", order=10, is_expanded=True)
        assert updated is not None
        assert updated.name == "New Name"
        assert updated.description == "Desc"
        assert updated.status == "paused"
        assert updated.order == 10
        assert updated.is_expanded is True

    async def test_update_team_not_found(self, db_engine):
        result = await update_team(str(uuid.uuid4()), name="x")
        assert result is None

    async def test_update_team_partial(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        updated = await update_team(team.id, name="Only Name")
        assert updated.name == "Only Name"
        assert updated.description is None

    async def test_delete_team(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        deleted = await delete_team(team.id)
        assert deleted is True
        fetched = await get_team(team.id)
        assert fetched is None

    async def test_delete_team_not_found(self, db_engine):
        deleted = await delete_team(str(uuid.uuid4()))
        assert deleted is False

    async def test_add_team_member(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        member = await add_team_member(team.id, name="Alice", role="Dev")
        assert member is not None
        assert member["name"] == "Alice"
        assert member["role"] == "Dev"
        assert member["order"] == 0

    async def test_add_team_member_increments_order(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        m1 = await add_team_member(team.id, name="First", role="PM")
        m2 = await add_team_member(team.id, name="Second", role="Dev")
        assert m2["order"] == 1

    async def test_add_team_member_with_agent_config(self, db_engine, sample_agent):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        member = await add_team_member(team.id, name="Linked", role="Dev", agent_config_id=sample_agent.id)
        assert member["agent_config_id"] == sample_agent.id

    async def test_add_team_member_team_not_found(self, db_engine):
        result = await add_team_member(str(uuid.uuid4()), name="Ghost")
        assert result is None

    async def test_remove_team_member(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        member = await add_team_member(team.id, name="Remove Me", role="Dev")
        removed = await remove_team_member(team.id, member["id"])
        assert removed is True

    async def test_remove_team_member_not_found(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        removed = await remove_team_member(team.id, str(uuid.uuid4()))
        assert removed is False

    async def test_reorder_team_members(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        m1 = await add_team_member(team.id, name="A", role="PM")
        m2 = await add_team_member(team.id, name="B", role="Dev")
        m3 = await add_team_member(team.id, name="C", role="Test")

        await reorder_team_members(team.id, [m3["id"], m1["id"], m2["id"]])

        fetched = await get_team(team.id)
        assert fetched is not None
        agents = fetched["agents"]
        assert agents[0]["name"] == "C"
        assert agents[1]["name"] == "A"
        assert agents[2]["name"] == "B"

    async def test_link_agent_config(self, db_engine, sample_agent):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        member = await add_team_member(team.id, name="Link Me", role="Dev")
        linked = await link_agent_config(member["id"], sample_agent.id)
        assert linked is True

    async def test_link_agent_config_not_found(self, db_engine):
        linked = await link_agent_config(str(uuid.uuid4()), str(uuid.uuid4()))
        assert linked is False

    async def test_get_team_with_members(self, db_engine, sample_agent):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        await add_team_member(team.id, name="M1", role="PM", agent_config_id=sample_agent.id)
        fetched = await get_team(team.id)
        assert len(fetched["agents"]) == 1
        assert fetched["agents"][0]["system_prompt"] is not None
        assert "tools" in fetched["agents"][0]
        assert "mcp" in fetched["agents"][0]
        assert "skills" in fetched["agents"][0]

    async def test_get_team_member_without_agent_config(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        await add_team_member(team.id, name="No Config", role="Dev")
        fetched = await get_team(team.id)
        agent = fetched["agents"][0]
        assert agent["system_prompt"] is None
        assert agent["tools"] == []
        assert agent["mcp"] == []
        assert agent["skills"] == []

    async def test_get_teams_list_structure(self, db_engine):
        team = await create_team(name=f"team-{uuid.uuid4().hex[:6]}")
        teams = await get_teams()
        assert len(teams) >= 1
        t = teams[0]
        assert "id" in t
        assert "name" in t
        assert "agents" in t
        assert "created_at" in t


# ── Session Repo Tests ──────────────────────────────────────────────────


class TestSessionRepo:
    async def test_create_session(self, db_engine):
        sess = await create_session(title="Test Session", user_id="u1", agent_id="a1")
        assert sess.id is not None
        assert sess.title == "Test Session"
        assert sess.user_id == "u1"
        assert sess.agent_id == "a1"

    async def test_create_session_defaults(self, db_engine):
        sess = await create_session()
        assert sess.title == "新对话"
        assert sess.user_id == "default"
        assert sess.agent_id is None

    async def test_get_session(self, db_engine):
        sess = await create_session(title="Get Test")
        found = await get_session(sess.id)
        assert found is not None
        assert found.id == sess.id

    async def test_get_session_not_found(self, db_engine):
        result = await get_session("nonexistent")
        assert result is None

    async def test_get_sessions(self, db_engine):
        await create_session(title="S1", user_id="u1")
        await create_session(title="S2", user_id="u2")
        sessions = await get_sessions(limit=10)
        assert len(sessions) >= 2

    async def test_get_sessions_filtered_by_user(self, db_engine):
        await create_session(title="My Session", user_id="filter_user")
        await create_session(title="Other", user_id="other")
        filtered = await get_sessions(user_id="filter_user")
        assert all(s.user_id == "filter_user" for s in filtered)

    async def test_get_sessions_filtered_by_agent(self, db_engine):
        agent_id = str(uuid.uuid4())
        await create_session(title="Agent Session", agent_id=agent_id)
        await create_session(title="No Agent")
        filtered = await get_sessions(agent_id=agent_id)
        assert len(filtered) == 1
        assert filtered[0].agent_id == agent_id

    async def test_get_sessions_empty(self, db_engine):
        sessions = await get_sessions(user_id="no_such_user_xyz")
        assert sessions == []

    async def test_update_session_title(self, db_engine):
        sess = await create_session(title="Original")
        updated = await update_session_title(sess.id, "Updated")
        assert updated is not None
        assert updated.title == "Updated"

    async def test_update_session_title_not_found(self, db_engine):
        result = await update_session_title("nonexistent", "Nope")
        assert result is None

    async def test_delete_session(self, db_engine):
        sess = await create_session(title="To Delete")
        deleted = await delete_session(sess.id)
        assert deleted is True
        found = await get_session(sess.id)
        assert found is None

    async def test_delete_session_not_found(self, db_engine):
        deleted = await delete_session("nonexistent")
        assert deleted is False


# ── Run Repo Tests ──────────────────────────────────────────────────────


class TestRunRepo:
    async def test_create_run(self, db_engine):
        run_id = await create_run(requirement="Build a feature")
        assert run_id is not None

    async def test_create_run_with_session(self, db_engine):
        sess = await create_session(title="Parent")
        run_id = await create_run(requirement="R1", session_id=sess.id)
        assert run_id is not None

    async def test_create_run_touches_session(self, db_engine):
        """Creating a run updates the parent session's updated_at."""
        from datetime import UTC, datetime
        sess = await create_session(title="Touch Test")
        old_updated = sess.updated_at

        import asyncio
        await asyncio.sleep(0.01)
        await create_run(requirement="Touch", session_id=sess.id)

        refetched = await get_session(sess.id)
        assert refetched.updated_at >= old_updated

    async def test_get_run(self, db_engine):
        run_id = await create_run(requirement="Get Test")
        fetched = await get_run(run_id)
        assert fetched is not None
        assert fetched.requirement == "Get Test"
        assert fetched.status == "pending"

    async def test_get_run_not_found(self, db_engine):
        result = await get_run("nonexistent")
        assert result is None

    async def test_get_runs(self, db_engine):
        await create_run(requirement="R1")
        await create_run(requirement="R2")
        runs = await get_runs()
        assert len(runs) >= 2

    async def test_get_session_runs(self, db_engine):
        sess = await create_session(title="Run Session")
        r1 = await create_run(requirement="R1", session_id=sess.id)
        r2 = await create_run(requirement="R2", session_id=sess.id)
        runs = await get_session_runs(sess.id)
        assert len(runs) == 2

    async def test_get_session_runs_empty(self, db_engine):
        runs = await get_session_runs("no-such-session")
        assert runs == []

    async def test_get_runs_by_session_ids(self, db_engine):
        s1 = await create_session(title="S1")
        s2 = await create_session(title="S2")
        r1 = await create_run(requirement="R1", session_id=s1.id)
        r2 = await create_run(requirement="R2", session_id=s2.id)

        grouped = await get_runs_by_session_ids([s1.id, s2.id])
        assert s1.id in grouped
        assert s2.id in grouped

    async def test_get_runs_by_session_ids_empty(self, db_engine):
        result = await get_runs_by_session_ids([])
        assert result == {}

    async def test_update_run_status(self, db_engine):
        run_id = await create_run(requirement="Status")
        await update_run_status(run_id, "running")
        fetched = await get_run(run_id)
        assert fetched.status == "running"

    async def test_update_run_status_not_found(self, db_engine):
        await update_run_status("nonexistent", "running")

    async def test_update_run_result(self, db_engine):
        run_id = await create_run(requirement="Result")
        await update_run_result(
            run_id, pm_document="Doc", code="code",
            review="LGTM", approved=True, status="converged",
        )
        fetched = await get_run(run_id)
        assert fetched.status == "converged"
        assert fetched.code == "code"
        assert fetched.approved is True

    async def test_update_run_result_not_found(self, db_engine):
        await update_run_result("nonexistent", "", "", "", False, "error")


# ── Message Repo Tests ──────────────────────────────────────────────────


class TestMessageRepo:
    async def test_save_and_get_messages(self, db_engine):
        sess = await create_session(title="Msg Sess")
        run_id = await create_run(requirement="Msg Run", session_id=sess.id)
        await save_message(
            run_id=run_id, role="user", agent_name="User",
            content="Hello", round_number=1,
        )
        msgs = await get_messages(run_id)
        assert len(msgs) == 1
        assert msgs[0].content == "Hello"
        assert msgs[0].role == "user"

    async def test_save_message_with_thinking(self, db_engine):
        sess = await create_session(title="Think")
        run_id = await create_run(requirement="Think Run", session_id=sess.id)
        await save_message(
            run_id=run_id, role="assistant", agent_name="Agent",
            content="Thoughtful", round_number=1, thinking="deep thoughts",
        )
        msgs = await get_messages(run_id)
        assert msgs[0].thinking == "deep thoughts"

    async def test_get_messages_empty(self, db_engine):
        msgs = await get_messages("no-such-run")
        assert msgs == []

    async def test_get_run_messages(self, db_engine):
        sess = await create_session(title="RM")
        run_id = await create_run(requirement="RM", session_id=sess.id)
        await save_message(run_id=run_id, role="user", agent_name="U", content="Hi", round_number=1)
        msgs = await get_run_messages(run_id)
        assert len(msgs) == 1

    async def test_get_session_messages(self, db_engine):
        sess = await create_session(title="SM")
        run_id = await create_run(requirement="SM", session_id=sess.id)
        await save_message(run_id=run_id, role="user", agent_name="U", content="Hi", round_number=1)
        msgs = await get_session_messages(sess.id)
        assert len(msgs) == 1
        assert msgs[0].content == "Hi"

    async def test_get_session_messages_empty(self, db_engine):
        msgs = await get_session_messages("no-such-session")
        assert msgs == []

    async def test_get_session_messages_exclude_run(self, db_engine):
        sess = await create_session(title="EX")
        run1 = await create_run(requirement="Keep", session_id=sess.id)
        run2 = await create_run(requirement="Exclude", session_id=sess.id)
        await save_message(run_id=run1, role="user", agent_name="U", content="Keep", round_number=1)
        await save_message(run_id=run2, role="user", agent_name="U", content="Exclude", round_number=1)

        msgs = await get_session_messages(sess.id, exclude_run_id=run2)
        assert len(msgs) == 1
        assert msgs[0].content == "Keep"

    async def test_multiple_messages_ordered(self, db_engine):
        sess = await create_session(title="Order")
        run_id = await create_run(requirement="Order", session_id=sess.id)
        await save_message(run_id=run_id, role="user", agent_name="U", content="First", round_number=1)
        await save_message(run_id=run_id, role="assistant", agent_name="A", content="Second", round_number=2)
        msgs = await get_messages(run_id)
        assert len(msgs) == 2
        assert msgs[0].content == "First"
        assert msgs[1].content == "Second"
