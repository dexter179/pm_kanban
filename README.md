# Project Management MVP

Kanban board web app with login and an AI assistant that can manage your cards. Next.js frontend statically served by a FastAPI backend, SQLite storage, OpenRouter for AI - all in one Docker container.

## Run

Requires Docker and an env file at `../.env` (relative to this repo) with `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL_NAME`.

```
scripts/start.ps1   # Windows
scripts/start.sh    # Mac / Linux
```

Open http://localhost:8000 and sign in with `user` / `password`. Stop with the matching `stop` script.

## Tests

- Backend: `cd backend && uv run pytest` (add `-m live` for real AI calls)
- Frontend: `cd frontend && npm run test:unit && npm run test:e2e`

## Docs

Plan and database design are in `docs/`. Each of `frontend/`, `backend/`, and `scripts/` has an `AGENTS.md` describing its contents.
