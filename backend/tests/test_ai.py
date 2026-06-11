import os
from unittest.mock import MagicMock, patch

import pytest

from app import ai


def test_ask_uses_openrouter_and_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL_NAME", "test/model")

    with patch("app.ai.OpenAI") as openai_cls:
        client = openai_cls.return_value
        completion = MagicMock()
        completion.choices = [MagicMock(message=MagicMock(content="4"))]
        client.chat.completions.create.return_value = completion

        answer = ai.ask("What is 2+2?")

    openai_cls.assert_called_once_with(
        base_url="https://openrouter.ai/api/v1", api_key="test-key"
    )
    client.chat.completions.create.assert_called_once_with(
        model="test/model",
        messages=[{"role": "user", "content": "What is 2+2?"}],
    )
    assert answer == "4"


def test_model_name_defaults(monkeypatch):
    monkeypatch.delenv("OPENROUTER_MODEL_NAME", raising=False)
    assert ai.model_name() == "openai/gpt-oss-120b"


@pytest.mark.live
def test_live_two_plus_two():
    if "OPENROUTER_API_KEY" not in os.environ:
        pytest.skip("OPENROUTER_API_KEY not set")
    answer = ai.ask("What is 2+2? Answer with just the number.")
    assert "4" in answer
