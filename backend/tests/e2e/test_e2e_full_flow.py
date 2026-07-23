import pytest
pytestmark = pytest.mark.integration

from backend.tests.e2e.test_agent_crud import TestAgentCRUD  # noqa: F401
from backend.tests.e2e.test_full_e2e import TestFullE2EFlow  # noqa: F401
from backend.tests.e2e.test_mcp_crud import TestMCPCrud  # noqa: F401
from backend.tests.e2e.test_prompt_crud import TestPromptCRUD  # noqa: F401
from backend.tests.e2e.test_session_run import TestSessionAndRun  # noqa: F401
from backend.tests.e2e.test_skill_crud import TestSkillCRUD  # noqa: F401
from backend.tests.e2e.test_team_crud import TestTeamCRUD  # noqa: F401
from backend.tests.e2e.test_tool_crud import TestToolCRUD  # noqa: F401
