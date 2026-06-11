import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import ai
from app.ai import AIBoard, ChatResult
from app.main import app
from app.models import Card, Column


def invalid_json_error() -> ValidationError:
    try:
        ChatResult.model_validate_json("not json")
    except ValidationError as error:
        return error


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))


@pytest.fixture
def client(temp_db):
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        yield client


def small_ai_board() -> AIBoard:
    return AIBoard(
        columns=[Column(id="col-1", title="Todo", cardIds=["card-1"])],
        cards=[Card(id="card-1", title="One", details="First")],
    )


def test_chat_requires_auth(temp_db):
    with TestClient(app) as client:
        assert client.post("/api/chat", json={"message": "hi"}).status_code == 401


def test_chat_reply_only_leaves_board_unchanged(client):
    before = client.get("/api/board").json()
    with patch("app.main.ai.chat", return_value=ChatResult(reply="Hello!")) as mock:
        response = client.post("/api/chat", json={"message": "hi"})
    assert response.status_code == 200
    assert response.json() == {"reply": "Hello!", "board": None}
    assert client.get("/api/board").json() == before
    # the current board JSON is passed to the AI
    assert mock.call_args.args[0] == before


def test_chat_forwards_history(client):
    history = [
        {"role": "user", "content": "first"},
        {"role": "assistant", "content": "second"},
    ]
    with patch("app.main.ai.chat", return_value=ChatResult(reply="ok")) as mock:
        client.post("/api/chat", json={"message": "third", "history": history})
    assert mock.call_args.args[1] == "third"
    assert mock.call_args.args[2] == history


def test_chat_valid_board_update_is_saved_and_returned(client):
    result = ChatResult(reply="Done.", board=small_ai_board())
    with patch("app.main.ai.chat", return_value=result):
        response = client.post("/api/chat", json={"message": "replace my board"})
    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Done."
    assert body["board"]["columns"][0]["title"] == "Todo"
    assert client.get("/api/board").json() == body["board"]


def test_chat_invalid_board_update_is_rejected_and_not_saved(client):
    invalid = small_ai_board()
    invalid.cards = []  # card-1 placed in a column but missing from cards
    before = client.get("/api/board").json()
    with patch("app.main.ai.chat", return_value=ChatResult(reply="Done.", board=invalid)):
        response = client.post("/api/chat", json={"message": "break my board"})
    assert response.status_code == 200
    body = response.json()
    assert body["board"] is None
    assert "was not applied" in body["reply"]
    assert client.get("/api/board").json() == before


def test_chat_returns_friendly_reply_when_ai_output_is_invalid(client):
    before = client.get("/api/board").json()
    with patch("app.main.ai.chat", side_effect=ai.AIResponseError("bad output")):
        response = client.post("/api/chat", json={"message": "hi"})
    assert response.status_code == 200
    body = response.json()
    assert body["board"] is None
    assert "try again" in body["reply"].lower()
    assert client.get("/api/board").json() == before


def test_chat_retries_once_on_invalid_json(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    parsed = ChatResult(reply="ok")
    good = type("Resp", (), {})()
    good.choices = [type("Choice", (), {"message": type("Msg", (), {"parsed": parsed})()})()]

    with patch("app.ai.OpenAI") as openai_cls:
        completions = openai_cls.return_value.chat.completions
        completions.parse.side_effect = [invalid_json_error(), good]
        result = ai.chat({"columns": [], "cards": {}}, "hi", [])

    assert result.reply == "ok"
    assert completions.parse.call_count == 2


def test_chat_raises_after_three_invalid_responses(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    with patch("app.ai.OpenAI") as openai_cls:
        completions = openai_cls.return_value.chat.completions
        completions.parse.side_effect = [
            invalid_json_error(),
            invalid_json_error(),
            invalid_json_error(),
        ]
        with pytest.raises(ai.AIResponseError):
            ai.chat({"columns": [], "cards": {}}, "hi", [])
    assert completions.parse.call_count == 3


def test_chat_retries_when_parsed_content_is_empty(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    parsed = ChatResult(reply="ok")
    empty = type("Resp", (), {})()
    empty.choices = [type("Choice", (), {"message": type("Msg", (), {"parsed": None})()})()]
    good = type("Resp", (), {})()
    good.choices = [type("Choice", (), {"message": type("Msg", (), {"parsed": parsed})()})()]

    with patch("app.ai.OpenAI") as openai_cls:
        completions = openai_cls.return_value.chat.completions
        completions.parse.side_effect = [empty, good]
        result = ai.chat({"columns": [], "cards": {}}, "hi", [])

    assert result.reply == "ok"
    assert completions.parse.call_count == 2


def test_chat_builds_messages_with_board_and_history(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board = {"columns": [], "cards": {}}
    history = [{"role": "user", "content": "earlier"}]

    with patch("app.ai.OpenAI") as openai_cls:
        parsed = ChatResult(reply="ok")
        completions = openai_cls.return_value.chat.completions
        completions.parse.return_value.choices = [
            type("Choice", (), {"message": type("Msg", (), {"parsed": parsed})()})()
        ]
        ai.chat(board, "now", history)

    call = completions.parse.call_args
    messages = call.kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert '"columns": []' in messages[0]["content"]
    assert messages[1] == {"role": "user", "content": "earlier"}
    assert messages[2] == {"role": "user", "content": "now"}
    assert call.kwargs["response_format"] is ChatResult
    # the output schema is also spelled out in the prompt for providers
    # that ignore response_format
    assert '"reply"' in messages[0]["content"]


@pytest.mark.live
def test_live_chat_moves_card(client):
    if "OPENROUTER_API_KEY" not in os.environ:
        pytest.skip("OPENROUTER_API_KEY not set")
    response = client.post(
        "/api/chat",
        json={"message": "Move the 'Align roadmap themes' card to the Done column."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["board"] is not None
    done = next(c for c in body["board"]["columns"] if c["title"] == "Done")
    assert "card-1" in done["cardIds"]
