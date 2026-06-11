# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Project Management MVP: a Kanban board web app with login and an AI chat sidebar that can create/edit/move cards. Single Docker container: Next.js 16 static export served by a FastAPI backend, SQLite storage, OpenRouter for AI.

Detailed per-directory docs exist and should be read when working in that area:
- `AGENTS.md` (root) - business requirements, technical decisions, coding standards, brand colors
- `backend/AGENTS.md`, `frontend/AGENTS.md`, `scripts/AGENTS.md` - layout and behavior of each part
- `docs/PLAN.md` - execution plan and working agreements; `docs/DATABASE.md` - schema

## Commands

Backend (from `backend/`):
- `uv sync` - install deps
- `uv run pytest` - tests (live AI tests deselected by default)
- `uv run pytest -m live` - real OpenRouter calls (needs `OPENROUTER_API_KEY`)
- `uv run pytest tests/test_board.py::test_name` - single test
- `uv run uvicorn app.main:app --reload` - dev server on 8000

Frontend (from `frontend/`):
- `npm run dev` - dev server with `/api/*` rewrites to localhost:8000 (run the backend too)
- `npm run lint` / `npm run build`
- `npm run test:unit` - Vitest; `npm run test:e2e` - Playwright; `npm run test:all` - both
- Single unit test: `npx vitest run src/components/KanbanBoard.test.tsx`
- E2E builds the static export and serves it through the backend itself (needs `uv` on PATH); chat is stubbed via route interception

Docker (the official run path): `scripts/start.ps1` / `start.sh` (compose up --build), `stop.ps1` / `stop.sh`. App at http://localhost:8000, sign in `user` / `password`.

## Architecture

One container, one origin. The Dockerfile builds the Next.js static export (`output: "export"`) in a Node stage and copies `out/` into the Python image's `static/` dir; FastAPI serves it at `/` with API routes registered first. In dev, `next dev` instead proxies `/api/*` to a locally running backend.

The board is a single JSON document. `BoardData {columns, cards}` (frontend `src/lib/kanban.ts`) is mirrored by Pydantic `Board` (backend `app/models.py`, which validates every card is placed exactly once) and stored as one JSON blob per user in SQLite (`app/db.py`, stdlib sqlite3, created/seeded on startup, path `DB_PATH` default `data/pm.db` - a Docker volume). `PUT /api/board` is a whole-document replace; the frontend optimistically updates state then PUTs the full board on every mutation.

AI chat (`backend/app/ai.py`): OpenRouter via the OpenAI SDK. `POST /api/chat` sends the system prompt with the board JSON + history; the model returns Structured Outputs parsed into `{reply, board | null}`. Because OpenRouter providers don't reliably enforce `response_format`, the schema is also repeated in the system prompt, temperature is 0.2, and bad JSON is retried up to 3 times before falling back to a friendly error reply (never a 500). A valid AI board update is validated and saved server-side before returning; the frontend then applies it.

Auth: hardcoded `user`/`password`, signed session cookie via itsdangerous (`SECRET_KEY` env). The DB supports multiple users but the MVP has one.

## Project rules (from AGENTS.md / docs/PLAN.md)

- Keep it simple: no over-engineering, no unnecessary defensive programming, no extra features. Concise docs, no emojis ever.
- When hitting issues, prove the root cause with evidence before fixing; do not guess.
- The env file is at `../.env` relative to the repo root (i.e. `C:\AILab\projects\.env`), with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL_NAME` (default model `openai/gpt-oss-120b`). Never commit or print its values.
- Confirm with the user before any Docker action (build, run, stop, or starting/stopping Docker Desktop).
- Machine note: `npx playwright install` hangs during extraction on this machine; Playwright config uses `channel: "chromium"` and the browser was installed manually (see `frontend/AGENTS.md`).
