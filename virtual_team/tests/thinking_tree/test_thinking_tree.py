"""Tests for virtual_team/thinking_tree/ — tool registry."""
def test_registry_importable():
    from virtual_team.thinking_tree.registry import registry
    assert registry is not None

def test_registry_tools_attribute():
    from virtual_team.thinking_tree.registry import registry
    assert hasattr(registry, "tools") or hasattr(registry, "register")
