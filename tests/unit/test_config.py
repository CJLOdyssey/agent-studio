"""Tests for configuration model and safety."""

import pytest
from pydantic import ValidationError

from virtual_team.config import TeamConfig


class TestTeamConfig:
    def test_api_key_masked_in_repr(self):
        cfg = TeamConfig(api_key="sk-secret-12345")
        r = repr(cfg)
        assert "sk-secret-12345" not in r
        assert "***" in r

    def test_api_key_unset_in_repr(self):
        cfg = TeamConfig(api_key="")
        r = repr(cfg)
        assert "(unset)" in r

    def test_validate_required_missing_api_key(self):
        cfg = TeamConfig(api_key="")
        errors = cfg.validate_required()
        assert len(errors) >= 1
        assert "API key" in errors[0]

    def test_validate_required_with_api_key(self):
        cfg = TeamConfig(api_key="sk-valid")
        errors = cfg.validate_required()
        assert len(errors) == 0

    def test_default_values(self):
        cfg = TeamConfig(api_key="sk-test")
        assert cfg.model == "gpt-4o"
        assert cfg.temperature == 0.7
        assert cfg.max_rounds == 5
        assert cfg.timeout == 120
        assert cfg.max_retries == 3

    def test_extra_fields_rejected(self):
        """Extra fields should be rejected due to model_config extra=forbid."""
        with pytest.raises(ValidationError):
            TeamConfig(api_key="sk-test", nonexistent_field="value")
