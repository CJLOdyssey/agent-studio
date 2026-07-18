from langchain_core.messages import HumanMessage

from backend.workflow.models import (
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
    create_initial_state,
    get_previous_artifacts,
)


def test_create_initial_state():
    state = create_initial_state("build a website")
    assert state["requirement"] == "build a website"
    assert state["round_number"] == 1
    assert state["artifacts"] == {}
    assert state["approved"] == {}
    assert len(state["messages"]) == 1
    assert isinstance(state["messages"][0], HumanMessage)


def test_get_node_by_role():
    nodes = [
        WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="writer", order=0),
        WorkflowNode(id="n2", agent_config_id="ag2", role_identifier="reviewer", order=1),
    ]
    config = WorkflowConfig(id="cfg", team_id="t1", name="test", nodes=nodes, edges=[])

    node = config.get_node_by_role("writer")
    assert node is not None
    assert node.id == "n1"

    node = config.get_node_by_role("nonexistent")
    assert node is None


def test_get_outgoing_edges():
    edges = [
        WorkflowEdge(from_node_id="n1", to_node_id="n2"),
        WorkflowEdge(from_node_id="n1", to_node_id="n3"),
        WorkflowEdge(from_node_id="n2", to_node_id="n3"),
    ]
    config = WorkflowConfig(id="cfg", team_id="t1", name="test", nodes=[], edges=edges)

    outgoing = config.get_outgoing_edges("n1")
    assert len(outgoing) == 2

    outgoing = config.get_outgoing_edges("nonexistent")
    assert len(outgoing) == 0


def test_get_entry_node():
    nodes = [
        WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="reviewer", order=1),
        WorkflowNode(id="n2", agent_config_id="ag2", role_identifier="writer", order=0),
    ]
    config = WorkflowConfig(id="cfg", team_id="t1", name="test", nodes=nodes, edges=[])

    entry = config.get_entry_node()
    assert entry is not None
    assert entry.role_identifier == "writer"

    empty = WorkflowConfig(id="empty", team_id="t1", name="empty", nodes=[], edges=[])
    assert empty.get_entry_node() is None


def test_get_previous_artifacts():
    nodes = [
        WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="writer", order=0),
        WorkflowNode(id="n2", agent_config_id="ag2", role_identifier="reviewer", order=1),
    ]
    edges = [
        WorkflowEdge(from_node_id="writer", to_node_id="n2"),
    ]
    config = WorkflowConfig(id="cfg", team_id="t1", name="test", nodes=nodes, edges=edges)

    state = create_initial_state("test")
    state["artifacts"] = {"writer": "draft content"}

    result = get_previous_artifacts(state, nodes[1], config)
    assert result == {"writer": "draft content"}


def test_get_previous_artifacts_no_incoming():
    node = WorkflowNode(id="n1", agent_config_id="ag1", role_identifier="solo", order=0)
    config = WorkflowConfig(id="cfg", team_id="t1", name="test", nodes=[node], edges=[])

    state = create_initial_state("test")
    result = get_previous_artifacts(state, node, config)
    assert result == {}
