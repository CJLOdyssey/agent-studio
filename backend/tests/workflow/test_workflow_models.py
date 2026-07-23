from langchain_core.messages import HumanMessage

from backend.workflow.models import (
    NodeStrategy,
    WorkflowConfig,
    WorkflowEdge,
    WorkflowNode,
    _merge_dicts,
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


class TestMergeDicts:
    def test_right_takes_precedence(self):
        result = _merge_dicts({"a": 1, "b": 2}, {"b": 3, "c": 4})
        assert result == {"a": 1, "b": 3, "c": 4}

    def test_empty_right(self):
        result = _merge_dicts({"a": 1}, {})
        assert result == {"a": 1}

    def test_empty_left(self):
        result = _merge_dicts({}, {"a": 1})
        assert result == {"a": 1}

    def test_both_empty(self):
        result = _merge_dicts({}, {})
        assert result == {}

    def test_original_left_unchanged(self):
        left = {"a": 1}
        _merge_dicts(left, {"b": 2})
        assert left == {"a": 1}


class TestNodeStrategy:
    def test_enum_values(self):
        assert NodeStrategy.GENERATOR.value == "generator"
        assert NodeStrategy.REVIEWER.value == "reviewer"
        assert NodeStrategy.REPORTER.value == "reporter"


class TestWorkflowNodeDefaults:
    def test_default_values(self):
        node = WorkflowNode()
        assert node.id == ""
        assert node.agent_config_id == ""
        assert node.role_identifier == ""
        assert node.strategy == NodeStrategy.GENERATOR
        assert node.order == 0


class TestWorkflowEdgeDefaults:
    def test_default_values(self):
        edge = WorkflowEdge()
        assert edge.id == ""
        assert edge.from_node_id == ""
        assert edge.to_node_id == ""
        assert edge.is_default is False
        assert edge.priority == 0


class TestWorkflowConfigDefaults:
    def test_default_values(self):
        config = WorkflowConfig()
        assert config.id == ""
        assert config.team_id == ""
        assert config.name == ""
        assert config.max_rounds == 5
        assert config.nodes == []
        assert config.edges == []
