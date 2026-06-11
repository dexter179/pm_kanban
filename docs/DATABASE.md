# Database Design

SQLite database storing users and their Kanban boards. The board itself is stored as a single JSON document, matching the shape the frontend already uses.

## File and lifecycle

- Engine: SQLite via Python stdlib `sqlite3`
- Path: `DB_PATH` env var, default `data/pm.db` inside the container; `data/` is a Docker volume so the database survives container rebuilds
- Created automatically on app startup if the file or tables do not exist, then seeded (see below). No migrations for the MVP

## Schema

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

- `users` supports multiple users for the future; the MVP has exactly one (`user`). Password stored as plain text only because credentials are hardcoded for the MVP; switch to hashing when real sign-up arrives
- `boards.user_id UNIQUE` enforces the MVP rule of one board per user; dropping the constraint later allows multiple boards
- `boards.data` holds the board JSON document; `updated_at` is ISO 8601 UTC

## Board JSON document

Mirrors the frontend `BoardData` type (`frontend/src/lib/kanban.ts`) so no translation layer is needed:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "...", "details": "..." }
  }
}
```

Rules, enforced by Pydantic validation on write:
- `columns` is an ordered array; column order is display order; `cardIds` order is card order within the column
- Every id in any `cardIds` must exist as a key in `cards`, and every card must appear in exactly one column
- Card `id` keys match the embedded `card.id`

## Seeding

On first startup (fresh database):
1. Insert user `user` / `password`
2. Insert that user's board using the current demo data (5 columns: Backlog, Discovery, In Progress, Review, Done, with the 8 demo cards)

## API access (Part 6)

- `GET /api/board` - return the signed-in user's board document
- `PUT /api/board` - validate and replace the whole document (matches JSON-document storage; no per-card endpoints needed)
