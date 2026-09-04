"""组织结构管理 - Organization Structure Management

实现多层级组织结构管理，包括：
- 部门/团队层级
- 成员关系管理
- 组织树操作
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class OrganizationType(Enum):
    """组织类型"""
    COMPANY = "company"
    DEPARTMENT = "department"
    TEAM = "team"
    GROUP = "group"


@dataclass
class OrganizationNode:
    """组织节点"""
    node_id: str
    name: str
    org_type: OrganizationType
    parent_id: str | None = None
    description: str = ""

    # 成员信息
    members: list[str] = field(default_factory=list)  # user_ids
    leaders: list[str] = field(default_factory=list)  # user_ids

    # 元数据
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "node_id": self.node_id,
            "name": self.name,
            "type": self.org_type.value,
            "parent_id": self.parent_id,
            "description": self.description,
            "members": self.members,
            "leaders": self.leaders,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class OrganizationMember:
    """组织成员"""
    user_id: str
    username: str
    email: str = ""

    # 组织关系
    node_ids: list[str] = field(default_factory=list)  # 所属组织节点
    role: str = "member"  # member, admin, leader

    # 元数据
    joined_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "node_ids": self.node_ids,
            "role": self.role,
            "joined_at": self.joined_at.isoformat(),
            "metadata": self.metadata,
        }


class OrganizationManager:
    """组织管理器"""

    def __init__(self) -> None:
        self.nodes: dict[str, OrganizationNode] = {}
        self.members: dict[str, OrganizationMember] = {}
        self.root_node_id: str | None = None

    def create_node(
        self,
        node_id: str,
        name: str,
        org_type: OrganizationType,
        parent_id: str | None = None,
        description: str = "",
    ) -> OrganizationNode:
        """创建组织节点"""
        if node_id in self.nodes:
            raise ValueError(f"Node {node_id} already exists")

        if parent_id and parent_id not in self.nodes:
            raise ValueError(f"Parent node {parent_id} not found")

        node = OrganizationNode(
            node_id=node_id,
            name=name,
            org_type=org_type,
            parent_id=parent_id,
            description=description,
        )
        self.nodes[node_id] = node

        # 设置根节点
        if parent_id is None:
            if self.root_node_id is not None:
                raise ValueError("Root node already exists")
            self.root_node_id = node_id

        return node

    def get_node(self, node_id: str) -> OrganizationNode | None:
        """获取组织节点"""
        return self.nodes.get(node_id)

    def update_node(
        self,
        node_id: str,
        name: str | None = None,
        description: str | None = None,
    ) -> OrganizationNode:
        """更新组织节点"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")

        node = self.nodes[node_id]
        if name:
            node.name = name
        if description is not None:
            node.description = description
        node.updated_at = datetime.now()

        return node

    def delete_node(self, node_id: str) -> None:
        """删除组织节点"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")

        # 检查是否有子节点
        children = self.get_children(node_id)
        if children:
            raise ValueError(f"Cannot delete node with children: {node_id}")

        # 从父节点移除
        node = self.nodes[node_id]
        if node.parent_id:
            # 移除成员关系
            for member_id in node.members:
                if member_id in self.members:
                    self.members[member_id].node_ids.remove(node_id)

        del self.nodes[node_id]

        if self.root_node_id == node_id:
            self.root_node_id = None

    def add_member(
        self,
        node_id: str,
        user_id: str,
        username: str,
        email: str = "",
        role: str = "member",
    ) -> OrganizationMember:
        """添加成员到组织节点"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")

        # 创建或获取成员
        if user_id not in self.members:
            member = OrganizationMember(
                user_id=user_id,
                username=username,
                email=email,
                role=role,
            )
            self.members[user_id] = member
        else:
            member = self.members[user_id]

        # 添加到节点
        node = self.nodes[node_id]
        if user_id not in node.members:
            node.members.append(user_id)

        # 添加节点到成员
        if node_id not in member.node_ids:
            member.node_ids.append(node_id)

        # 如果是leader，添加到leaders列表
        if role == "leader" and user_id not in node.leaders:
            node.leaders.append(user_id)

        return member

    def remove_member(self, node_id: str, user_id: str) -> None:
        """从组织节点移除成员"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")

        if user_id not in self.members:
            raise ValueError(f"Member {user_id} not found")

        node = self.nodes[node_id]
        member = self.members[user_id]

        # 从节点移除
        if user_id in node.members:
            node.members.remove(user_id)
        if user_id in node.leaders:
            node.leaders.remove(user_id)

        # 从成员移除节点
        if node_id in member.node_ids:
            member.node_ids.remove(node_id)

    def get_children(self, node_id: str) -> list[OrganizationNode]:
        """获取子节点"""
        return [
            node for node in self.nodes.values()
            if node.parent_id == node_id
        ]

    def get_ancestors(self, node_id: str) -> list[OrganizationNode]:
        """获取祖先节点"""
        ancestors = []
        current = self.nodes.get(node_id)

        while current and current.parent_id:
            parent = self.nodes.get(current.parent_id)
            if parent:
                ancestors.append(parent)
                current = parent
            else:
                break

        return ancestors

    def get_descendants(self, node_id: str) -> list[OrganizationNode]:
        """获取所有后代节点"""
        descendants = []
        children = self.get_children(node_id)

        for child in children:
            descendants.append(child)
            descendants.extend(self.get_descendants(child.node_id))

        return descendants

    def get_all_members(self, node_id: str, include_descendants: bool = False) -> list[str]:
        """获取所有成员"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")

        members = set(self.nodes[node_id].members)

        if include_descendants:
            descendants = self.get_descendants(node_id)
            for desc in descendants:
                members.update(desc.members)

        return list(members)

    def get_user_nodes(self, user_id: str) -> list[OrganizationNode]:
        """获取用户所属的所有组织节点"""
        if user_id not in self.members:
            return []

        member = self.members[user_id]
        return [self.nodes[nid] for nid in member.node_ids if nid in self.nodes]

    def get_organization_tree(self) -> dict[str, Any]:
        """获取组织树"""
        if not self.root_node_id:
            return {}

        def build_tree(node_id: str) -> dict[str, Any]:
            node = self.nodes[node_id]
            children = self.get_children(node_id)

            return {
                "node": node.to_dict(),
                "children": [build_tree(child.node_id) for child in children],
            }

        return build_tree(self.root_node_id)

    def get_statistics(self) -> dict[str, Any]:
        """获取组织统计信息"""
        total_nodes = len(self.nodes)
        total_members = len(self.members)

        # 按类型统计节点
        type_counts: dict[str, int] = {}
        for node in self.nodes.values():
            type_name = node.org_type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1

        # 计算平均成员数
        avg_members = (
            sum(len(node.members) for node in self.nodes.values()) / total_nodes
            if total_nodes > 0 else 0
        )

        return {
            "total_nodes": total_nodes,
            "total_members": total_members,
            "node_type_distribution": type_counts,
            "average_members_per_node": avg_members,
        }
