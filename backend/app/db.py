import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_BOARD = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    path = Path(os.environ.get("DB_PATH", "data/pm.db"))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    # sqlite3's context manager only manages the transaction; closing()
    # actually closes the connection.
    with closing(connect()) as conn, conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                created_at TEXT NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )"""
        )
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            cursor = conn.execute(
                "INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)",
                ("user", "password", _now()),
            )
            conn.execute(
                "INSERT INTO boards (user_id, data, updated_at) VALUES (?, ?, ?)",
                (cursor.lastrowid, json.dumps(DEFAULT_BOARD), _now()),
            )


def get_board(username: str) -> dict:
    with closing(connect()) as conn:
        row = conn.execute(
            """SELECT boards.data FROM boards
               JOIN users ON users.id = boards.user_id
               WHERE users.username = ?""",
            (username,),
        ).fetchone()
    return json.loads(row["data"])


def save_board(username: str, board: dict) -> None:
    with closing(connect()) as conn, conn:
        conn.execute(
            """UPDATE boards SET data = ?, updated_at = ?
               WHERE user_id = (SELECT id FROM users WHERE username = ?)""",
            (json.dumps(board), _now(), username),
        )
