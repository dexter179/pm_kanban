from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME
from app.main import app


def make_client() -> TestClient:
    return TestClient(app)


def test_login_success_sets_cookie():
    client = make_client()
    response = client.post(
        "/api/login", json={"username": "user", "password": "password"}
    )
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert COOKIE_NAME in response.cookies


def test_login_wrong_credentials():
    client = make_client()
    response = client.post(
        "/api/login", json={"username": "user", "password": "wrong"}
    )
    assert response.status_code == 401
    assert COOKIE_NAME not in response.cookies


def test_me_requires_session():
    client = make_client()
    response = client.get("/api/me")
    assert response.status_code == 401


def test_me_with_session():
    client = make_client()
    client.post("/api/login", json={"username": "user", "password": "password"})
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_me_rejects_tampered_cookie():
    client = make_client()
    client.cookies.set(COOKIE_NAME, "forged-value")
    response = client.get("/api/me")
    assert response.status_code == 401


def test_logout_clears_session():
    client = make_client()
    client.post("/api/login", json={"username": "user", "password": "password"})
    response = client.post("/api/logout")
    assert response.status_code == 200
    assert client.get("/api/me").status_code == 401
