"""Unit tests for virtual_team/repository/ (base patterns and imports)."""






class TestRepositoryImports:
    def test_import_deps(self):
        from virtual_team.repository.deps import get_session

        assert get_session is not None

    def test_get_session_is_asyncgen(self):
        import inspect

        from virtual_team.repository.deps import get_session
        assert inspect.isasyncgenfunction(get_session)

    def test_session_factory_import(self):
        from virtual_team.database import get_session_factory

        assert get_session_factory is not None

    def test_repository_subclass_has_model(self):
        from virtual_team.database import RegisteredSkillDB
        from virtual_team.repository.skills import SkillRepository

        assert SkillRepository.model is RegisteredSkillDB

    def test_repository_subclass_imports(self):
        from virtual_team.repository.mcps import MCPRepository
        from virtual_team.repository.prompts import PromptRepository
        from virtual_team.repository.tools import ToolRepository

        assert ToolRepository is not None
        assert MCPRepository is not None
        assert PromptRepository is not None
