import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from openai import OpenAIError
from pydantic import BaseModel, ValidationError

from app import ai, db
from app.auth import COOKIE_NAME, PASSWORD, USERNAME, CurrentUser, create_session
from app.models import Board


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Project Management MVP", lifespan=lifespan)


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/login")
def login(body: LoginRequest, response: Response) -> dict[str, str]:
    if body.username != USERNAME or body.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    response.set_cookie(
        COOKIE_NAME, create_session(body.username), httponly=True, samesite="lax"
    )
    return {"username": body.username}


@app.post("/api/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@app.get("/api/me")
def me(username: CurrentUser) -> dict[str, str]:
    return {"username": username}


@app.get("/api/board")
def get_board(username: CurrentUser) -> Board:
    return Board.model_validate(db.get_board(username))


@app.put("/api/board")
def put_board(board: Board, username: CurrentUser) -> Board:
    db.save_board(username, board.model_dump())
    return board


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    board: Board | None = None


@app.post("/api/chat")
def chat(body: ChatRequest, username: CurrentUser) -> ChatResponse:
    current = db.get_board(username)
    try:
        result = ai.chat(
            current, body.message, [message.model_dump() for message in body.history]
        )
    except (OpenAIError, ai.AIResponseError):
        logging.getLogger("uvicorn.error").exception("AI chat request failed")
        return ChatResponse(
            reply="The assistant could not produce a valid response. Please try again."
        )
    if result.board is None:
        return ChatResponse(reply=result.reply)
    try:
        board = Board(
            columns=result.board.columns,
            cards={card.id: card for card in result.board.cards},
        )
    except ValidationError:
        return ChatResponse(
            reply=result.reply
            + "\n\n(Note: the suggested board update was invalid and was not applied.)"
        )
    db.save_board(username, board.model_dump())
    return ChatResponse(reply=result.reply, board=board)


static_dir = Path(
    os.environ.get("STATIC_DIR", Path(__file__).resolve().parent.parent / "static")
)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
