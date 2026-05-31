import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from virtual_team.config import TeamConfig, load_config


class TestTeamConfig:
    def test_config_defaults(self):
        config = TeamConfig()
        assert config.max_rounds == 5
        assert config.temperature == 0.7
        assert config.model == "gpt-4o"
        assert config.api_base is None

    def test_config_custom_values(self):
        config = TeamConfig(
            api_key="sk-test",
            model="gpt-4o-mini",
            temperature=0.3,
            max_rounds=10,
            api_base="https://custom.api.com",
        )
        assert config.api_key == "sk-test"
        assert config.model == "gpt-4o-mini"
        assert config.temperature == 0.3
        assert config.max_rounds == 10
        assert config.api_base == "https://custom.api.com"

    def test_config_temperature_range_low(self):
        with pytest.raises(ValidationError):
            TeamConfig(temperature=-0.1)

    def test_config_temperature_range_high(self):
        with pytest.raises(ValidationError):
            TeamConfig(temperature=2.0)

    def test_config_temperature_edge_low(self):
        config = TeamConfig(temperature=0.0)
        assert config.temperature == 0.0

    def test_config_temperature_edge_high(self):
        config = TeamConfig(temperature=1.0)
        assert config.temperature == 1.0

    def test_config_max_rounds_minimum(self):
        config = TeamConfig(max_rounds=1)
        assert config.max_rounds == 1

    def test_config_max_rounds_too_low(self):
        with pytest.raises(ValidationError):
            TeamConfig(max_rounds=0)

    def test_config_invalid_model_name(self):
        with pytest.raises(ValidationError):
            TeamConfig(model="")


class TestBuildLLMConfig:
    def test_build_llm_config_basic(self):
        config = TeamConfig(api_key="sk-test")
        llm_config = config.build_llm_config()
        assert llm_config["config_list"][0]["model"] == "gpt-4o"
        assert llm_config["config_list"][0]["api_key"] == "sk-test"
        assert llm_config["config_list"][0]["timeout"] == 120
        assert llm_config["config_list"][0]["max_retries"] == 3
        assert llm_config["temperature"] == 0.7
        assert llm_config["max_retries"] == 3

    def test_build_llm_config_with_base_url(self):
        config = TeamConfig(
            api_key="sk-test", api_base="https://custom.api.com", model="gpt-4o-mini"
        )
        llm_config = config.build_llm_config()
        assert llm_config["config_list"][0]["base_url"] == "https://custom.api.com"
        assert llm_config["config_list"][0]["model"] == "gpt-4o-mini"

    def test_build_llm_config_custom_temperature(self):
        config = TeamConfig(api_key="sk-test", temperature=0.5)
        llm_config = config.build_llm_config()
        assert llm_config["temperature"] == 0.5

    def test_build_llm_config_custom_retries(self):
        config = TeamConfig(api_key="sk-test", max_retries=5)
        llm_config = config.build_llm_config()
        assert llm_config["config_list"][0]["max_retries"] == 5
        assert llm_config["max_retries"] == 5

    def test_config_defaults_max_retries(self):
        config = TeamConfig()
        assert config.max_retries == 3

    def test_config_defaults_timeout(self):
        config = TeamConfig()
        assert config.timeout == 120


class TestLoadConfig:
    @patch.dict(os.environ, {}, clear=True)
    def test_load_config_no_env_vars(self):
        config = load_config()
        assert config.api_key == ""

    @patch.dict(
        os.environ,
        {
            "OPENAI_API_KEY": "sk-env-key",
            "OPENAI_BASE_URL": "https://env.api.com",
            "OPENAI_MODEL": "gpt-4o-mini",
            "MAX_ROUNDS": "8",
            "TEMPERATURE": "0.5",
        },
        clear=True,
    )
    def test_load_config_from_env(self):
        config = load_config()
        assert config.api_key == "sk-env-key"
        assert config.api_base == "https://env.api.com"
        assert config.model == "gpt-4o-mini"
        assert config.max_rounds == 8
        assert config.temperature == 0.5

    @patch.dict(os.environ, {"OPENAI_API_KEY": "sk-key", "MAX_ROUNDS": "invalid"}, clear=True)
    def test_load_config_invalid_max_rounds(self):
        config = load_config()
        assert config.max_rounds == 5

    @patch.dict(os.environ, {"OPENAI_API_KEY": "sk-key", "TEMPERATURE": "invalid"}, clear=True)
    def test_load_config_invalid_temperature(self):
        config = load_config()
        assert config.temperature == 0.7
