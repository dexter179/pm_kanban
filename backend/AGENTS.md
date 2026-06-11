# Backend

Python FastAPI backend managed with uv (Python 3.14).

## Layout

- `pyproject.toml` - uv project. Runtime deps: fastapi, uvicorn, itsdangerous, openai. Dev: pytest, httpx2 (the successor to httpx; starlette's TestClient deprecated plain httpx). Pytest config sets `pythonpath = ["."]` and deselects `live` tests by default
- `app/main.py` - FastAPI app and all routes; serves the static frontend at `/` (dir from `STATIC_DIR`, default `static/`). API routes are registered before the static mount. Startup lifespan calls `db.init_db()`
- `app/auth.py` - hardcoded `user`/`password` check, signed session cookie via itsdangerous (`SECRET_KEY` env, random per-process fallback), `CurrentUser` dependency
- `app/db.py` - stdlib sqlite3; creates and seeds the database on startup (path from `DB_PATH`, default `data/pm.db`); `get_board`/`save_board` store the board as one JSON document. Schema in `docs/DATABASE.md`
- `app/models.py` - Pydantic `Card`/`Column`/`Board` mirroring the frontend `BoardData`; validates every card is placed exactly once and keys match ids
- `app/ai.py` - OpenRouter via the OpenAI SDK (`OPENROUTER_API_KEY`, model from `OPENROUTER_MODEL_NAME`, default `openai/gpt-oss-120b`). `ask()` for plain completion; `chat()` sends system prompt with the board JSON + history and parses Structured Outputs into `ChatResult {reply, board: AIBoard | None}`. `AIBoard` uses a card list (strict schemas cannot express dict keys); `main.chat` converts to `Board`, validates, saves. Reliability: OpenRouter providers for this model do not all enforce `response_format` (and `require_parameters` 404s because none declare full support), so the schema is repeated in the system prompt, temperature is 0.2, and bad/empty JSON is retried up to 3 attempts before raising `AIResponseError`; the endpoint logs that and returns a friendly reply instead of a 500
- `static/` - placeholder page for backend-only runs; the Docker image overwrites it with the Next.js export
- `tests/` - pytest suites: health, auth, board CRUD/validation/persistence, chat (mocked AI), plus `-m live` tests that hit OpenRouter for real

## Routes

- `GET /api/health`
- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/board`, `PUT /api/board` (whole-document replace, 422 on invalid)
- `POST /api/chat` `{message, history}` -> `{reply, board | null}`; valid AI board updates are saved before returning

## Commands (from backend/)

- `uv sync` / `uv run pytest` / `uv run pytest -m live` (needs `OPENROUTER_API_KEY` in env)
- `uv run uvicorn app.main:app --reload` - local dev server on 8000
