import os
from typing import Annotated

from fastapi import HTTPException, Request
from fastapi.params import Depends
from itsdangerous import BadSignature, URLSafeSerializer

USERNAME = "user"
PASSWORD = "password"
COOKIE_NAME = "session"

_serializer = URLSafeSerializer(
    os.environ.get("SECRET_KEY", "dev-secret-change-me"), salt="session"
)


def create_session(username: str) -> str:
    return _serializer.dumps(username)


def read_session(value: str) -> str | None:
    try:
        return _serializer.loads(value)
    except BadSignature:
        return None


def current_user(request: Request) -> str:
    value = request.cookies.get(COOKIE_NAME)
    username = read_session(value) if value else None
    if username is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


CurrentUser = Annotated[str, Depends(current_user)]
