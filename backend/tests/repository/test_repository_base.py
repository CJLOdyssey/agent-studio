"""Unit tests for backend/repository/ (base patterns and imports)."""






class TestRepositoryImports:
    def test_import_deps(self):
        from backend.repository.deps import get_session

        assert get_session is not None

    def test_get_session_is_asyncgen(self):
        import inspect

        from backend.repository.deps import get_session
        assert inspect.isasyncgenfunction(get_session)

    def test_session_factory_import(self):
        from backend.core.infra.database import get_session_factory

        assert get_session_factory is not None

    def test_repository_subclass_has_model(self):
        from backend.core.infra.database import RegisteredSkillDB
        from backend.repository.skills import SkillRepository

        assert SkillRepository.model is RegisteredSkillDB

    def test_repository_subclass_imports(self):
        from backend.repository.mcps import MCPRepository
        from backend.repository.prompts import PromptRepository
        from backend.repository.tools import ToolRepository

        assert ToolRepository is not None
        assert MCPRepository is not None
        assert PromptRepository is not None
