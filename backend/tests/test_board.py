import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))


@pytest.fixture
def client(temp_db):
    with TestClient(app) as client:
        yield client


def sign_in(client: TestClient) -> None:
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_board_requires_auth(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401


def test_fresh_db_is_seeded(client):
    sign_in(client)
    board = client.get("/api/board").json()
    assert len(board["columns"]) == 5
    assert len(board["cards"]) == 8
    assert board["columns"][0]["title"] == "Backlog"


def test_put_then_get_roundtrip(client):
    sign_in(client)
    board = client.get("/api/board").json()
    # move the first backlog card to Done and rename a column
    moved = board["columns"][0]["cardIds"].pop(0)
    board["columns"][4]["cardIds"].append(moved)
    board["columns"][1]["title"] = "Research"

    response = client.put("/api/board", json=board)
    assert response.status_code == 200
    assert client.get("/api/board").json() == board


def test_put_rejects_card_missing_from_cards_map(client):
    sign_in(client)
    board = client.get("/api/board").json()
    board["columns"][0]["cardIds"].append("card-ghost")
    assert client.put("/api/board", json=board).status_code == 422


def test_put_rejects_card_in_two_columns(client):
    sign_in(client)
    board = client.get("/api/board").json()
    board["columns"][1]["cardIds"].append(board["columns"][0]["cardIds"][0])
    assert client.put("/api/board", json=board).status_code == 422


def test_put_rejects_unplaced_card(client):
    sign_in(client)
    board = client.get("/api/board").json()
    board["columns"][0]["cardIds"].pop(0)
    assert client.put("/api/board", json=board).status_code == 422


def test_put_rejects_card_key_mismatch(client):
    sign_in(client)
    board = client.get("/api/board").json()
    first_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_id]["id"] = "card-other"
    assert client.put("/api/board", json=board).status_code == 422


def test_board_persists_across_restart(temp_db):
    with TestClient(app) as client:
        sign_in(client)
        board = client.get("/api/board").json()
        board["columns"][0]["title"] = "Icebox"
        client.put("/api/board", json=board)

    with TestClient(app) as client:
        sign_in(client)
        assert client.get("/api/board").json()["columns"][0]["title"] == "Icebox"
