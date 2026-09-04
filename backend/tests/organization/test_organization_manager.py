"""OrganizationManager 单元测试"""

import pytest

from organization.organization_manager import (
    OrganizationManager,
    OrganizationMember,
    OrganizationNode,
    OrganizationType,
)


@pytest.fixture
def manager() -> OrganizationManager:
    return OrganizationManager()


@pytest.fixture
def tree_manager(manager: OrganizationManager) -> OrganizationManager:
    manager.create_node("root", "Root", OrganizationType.COMPANY)
    manager.create_node("eng", "Engineering", OrganizationType.DEPARTMENT, parent_id="root")
    manager.create_node("product", "Product", OrganizationType.DEPARTMENT, parent_id="root")
    manager.create_node("fe", "Frontend", OrganizationType.TEAM, parent_id="eng")
    manager.create_node("be", "Backend", OrganizationType.TEAM, parent_id="eng")
    return manager


class TestOrganizationNode:
    def test_to_dict(self) -> None:
        node = OrganizationNode(node_id="n1", name="Test", org_type=OrganizationType.TEAM)
        d = node.to_dict()
        assert d["node_id"] == "n1"
        assert d["name"] == "Test"
        assert d["type"] == "team"
        assert d["parent_id"] is None
        assert d["members"] == []
        assert d["leaders"] == []
        assert "created_at" in d


class TestOrganizationMember:
    def test_to_dict(self) -> None:
        m = OrganizationMember(user_id="u1", username="alice", email="a@b.com")
        d = m.to_dict()
        assert d["user_id"] == "u1"
        assert d["username"] == "alice"
        assert d["email"] == "a@b.com"
        assert d["role"] == "member"


class TestCreateNode:
    def test_create_root(self, manager: OrganizationManager) -> None:
        node = manager.create_node("root", "Root", OrganizationType.COMPANY)
        assert node.node_id == "root"
        assert manager.root_node_id == "root"

    def test_create_child(self, manager: OrganizationManager) -> None:
        manager.create_node("root", "Root", OrganizationType.COMPANY)
        child = manager.create_node("child", "Child", OrganizationType.TEAM, parent_id="root")
        assert child.parent_id == "root"

    def test_duplicate_node_id_raises(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        with pytest.raises(ValueError, match="already exists"):
            manager.create_node("n1", "N2", OrganizationType.TEAM)

    def test_missing_parent_raises(self, manager: OrganizationManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            manager.create_node("n1", "N1", OrganizationType.TEAM, parent_id="nope")

    def test_second_root_raises(self, manager: OrganizationManager) -> None:
        manager.create_node("r1", "R1", OrganizationType.COMPANY)
        with pytest.raises(ValueError, match="Root node already exists"):
            manager.create_node("r2", "R2", OrganizationType.COMPANY)


class TestGetNode:
    def test_found(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        assert manager.get_node("n1") is not None

    def test_not_found(self, manager: OrganizationManager) -> None:
        assert manager.get_node("nope") is None


class TestUpdateNode:
    def test_update_name(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        updated = manager.update_node("n1", name="New Name")
        assert updated.name == "New Name"

    def test_update_description(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        updated = manager.update_node("n1", description="desc")
        assert updated.description == "desc"

    def test_not_found_raises(self, manager: OrganizationManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            manager.update_node("nope", name="X")


class TestDeleteNode:
    def test_delete_leaf(self, manager: OrganizationManager) -> None:
        manager.create_node("r", "R", OrganizationType.COMPANY)
        manager.create_node("c", "C", OrganizationType.TEAM, parent_id="r")
        manager.delete_node("c")
        assert manager.get_node("c") is None

    def test_delete_not_found_raises(self, manager: OrganizationManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            manager.delete_node("nope")

    def test_delete_with_children_raises(self, tree_manager: OrganizationManager) -> None:
        with pytest.raises(ValueError, match="Cannot delete node with children"):
            tree_manager.delete_node("eng")

    def test_delete_clears_root(self, manager: OrganizationManager) -> None:
        manager.create_node("r", "R", OrganizationType.COMPANY)
        manager.delete_node("r")
        assert manager.root_node_id is None

    def test_delete_removes_member_node_ids(self, manager: OrganizationManager) -> None:
        manager.create_node("r", "R", OrganizationType.COMPANY)
        manager.create_node("c", "C", OrganizationType.TEAM, parent_id="r")
        manager.add_member("c", "u1", "alice")
        manager.delete_node("c")
        assert "c" not in manager.members["u1"].node_ids


class TestAddMember:
    def test_add_new_member(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        member = manager.add_member("n1", "u1", "alice", email="a@b.com")
        assert member.user_id == "u1"
        assert "n1" in manager.members["u1"].node_ids

    def test_add_existing_member_to_new_node(self, manager: OrganizationManager) -> None:
        manager.create_node("root", "Root", OrganizationType.COMPANY)
        manager.create_node("n1", "N1", OrganizationType.TEAM, parent_id="root")
        manager.create_node("n2", "N2", OrganizationType.TEAM, parent_id="root")
        manager.add_member("n1", "u1", "alice")
        manager.add_member("n2", "u1", "alice")
        assert len(manager.members["u1"].node_ids) == 2

    def test_add_leader(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        manager.add_member("n1", "u1", "alice", role="leader")
        assert "u1" in manager.nodes["n1"].leaders

    def test_not_found_node_raises(self, manager: OrganizationManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            manager.add_member("nope", "u1", "alice")


class TestRemoveMember:
    def test_remove(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        manager.add_member("n1", "u1", "alice")
        manager.remove_member("n1", "u1")
        assert "u1" not in manager.nodes["n1"].members

    def test_remove_leader(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        manager.add_member("n1", "u1", "alice", role="leader")
        manager.remove_member("n1", "u1")
        assert "u1" not in manager.nodes["n1"].leaders

    def test_node_not_found_raises(self, manager: OrganizationManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            manager.remove_member("nope", "u1")

    def test_member_not_found_raises(self, manager: OrganizationManager) -> None:
        manager.create_node("n1", "N1", OrganizationType.TEAM)
        with pytest.raises(ValueError, match="not found"):
            manager.remove_member("n1", "nope")


class TestGetChildren:
    def test_children(self, tree_manager: OrganizationManager) -> None:
        children = tree_manager.get_children("root")
        assert len(children) == 2

    def test_no_children(self, tree_manager: OrganizationManager) -> None:
        assert tree_manager.get_children("fe") == []


class TestGetAncestors:
    def test_multi_level(self, tree_manager: OrganizationManager) -> None:
        ancestors = tree_manager.get_ancestors("fe")
        ids = [a.node_id for a in ancestors]
        assert ids == ["eng", "root"]

    def test_root_has_no_ancestors(self, tree_manager: OrganizationManager) -> None:
        assert tree_manager.get_ancestors("root") == []


class TestGetDescendants:
    def test_deep_recursion(self, tree_manager: OrganizationManager) -> None:
        descendants = tree_manager.get_descendants("root")
        ids = {d.node_id for d in descendants}
        assert ids == {"eng", "product", "fe", "be"}

    def test_no_children(self, tree_manager: OrganizationManager) -> None:
        assert tree_manager.get_descendants("fe") == []


class TestGetAllMembers:
    def test_without_descendants(self, tree_manager: OrganizationManager) -> None:
        tree_manager.add_member("eng", "u1", "alice")
        tree_manager.add_member("fe", "u2", "bob")
        members = tree_manager.get_all_members("eng")
        assert "u1" in members
        assert "u2" not in members

    def test_with_descendants(self, tree_manager: OrganizationManager) -> None:
        tree_manager.add_member("eng", "u1", "alice")
        tree_manager.add_member("fe", "u2", "bob")
        members = tree_manager.get_all_members("eng", include_descendants=True)
        assert "u1" in members
        assert "u2" in members

    def test_not_found_raises(self, tree_manager: OrganizationManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            tree_manager.get_all_members("nope")


class TestGetUserNodes:
    def test_user_in_multiple_nodes(self, tree_manager: OrganizationManager) -> None:
        tree_manager.add_member("eng", "u1", "alice")
        tree_manager.add_member("fe", "u1", "alice")
        nodes = tree_manager.get_user_nodes("u1")
        assert len(nodes) == 2

    def test_unknown_user(self, tree_manager: OrganizationManager) -> None:
        assert tree_manager.get_user_nodes("nope") == []


class TestGetOrganizationTree:
    def test_empty(self, manager: OrganizationManager) -> None:
        assert manager.get_organization_tree() == {}

    def test_nested(self, tree_manager: OrganizationManager) -> None:
        tree = tree_manager.get_organization_tree()
        assert tree["node"]["node_id"] == "root"
        assert len(tree["children"]) == 2
        eng_child = next(c for c in tree["children"] if c["node"]["node_id"] == "eng")
        assert len(eng_child["children"]) == 2


class TestGetStatistics:
    def test_empty(self, manager: OrganizationManager) -> None:
        stats = manager.get_statistics()
        assert stats["total_nodes"] == 0
        assert stats["total_members"] == 0
        assert stats["average_members_per_node"] == 0

    def test_with_data(self, tree_manager: OrganizationManager) -> None:
        tree_manager.add_member("eng", "u1", "alice")
        tree_manager.add_member("fe", "u2", "bob")
        stats = tree_manager.get_statistics()
        assert stats["total_nodes"] == 5
        assert stats["total_members"] == 2
        assert "department" in stats["node_type_distribution"]
