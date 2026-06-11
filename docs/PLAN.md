# Project Plan: Project Management MVP

Detailed execution plan for the 10 parts. Each part lists steps as a checklist, the tests that prove it works, and success criteria. Update checkboxes as work completes.

## Working agreements

- The env file lives at `C:\AILab\projects\.env` (one level above the project root). It defines `OPENROUTER_API_KEY` and `OPENROUTER_MODEL_NAME`. Pass it to the container via env-file; never commit or print its values.
- Model: use `OPENROUTER_MODEL_NAME` from the env file, defaulting to `openai/gpt-oss-120b`.
- User sign-off gates: after Part 1 (this plan) and Part 5 (database design). Other parts proceed continuously with progress reports.
- Docker Desktop is installed, but confirm with the user before any Docker action (build, run, stop, or starting/stopping Docker Desktop itself).
- The official run path is the Docker container via `scripts/`. `npm run dev` with `/api` rewrites to the local backend remains a dev-only convenience.
- Coding standards from AGENTS.md apply throughout: latest idiomatic libraries, keep it simple, concise docs, no emojis, root-cause-first debugging.

## Part 1: Plan

Steps:
- [x] Review existing frontend code, configs, and tests
- [x] Enrich this document with substeps, tests, and success criteria per part
- [x] Create `frontend/AGENTS.md` describing the existing frontend code
- [x] User reviews and approves the plan (SIGN-OFF GATE)

Success criteria: user approves the plan.

## Part 2: Scaffolding

Backend skeleton, Docker, and start/stop scripts. Hello-world static page served by FastAPI that also calls the API.

Steps:
- [x] Create `backend/` as a uv project (`pyproject.toml`) with FastAPI and uvicorn
- [x] `app/main.py`: FastAPI app with `GET /api/health` returning `{"status": "ok"}`
- [x] Serve `backend/static/` at `/` (placeholder `index.html` that fetches `/api/health` and displays the result, proving a browser-to-API call works)
- [x] `Dockerfile` at repo root: Python base image, uv-managed install, runs uvicorn on port 8000
- [x] `docker-compose.yml` at repo root: one `app` service, port 8000, `env_file` pointing at `C:\AILab\projects\.env` (path `../.env` relative to repo root)
- [x] Scripts in `scripts/`: `start.ps1`/`stop.ps1` (PC) and `start.sh`/`stop.sh` (Mac and Linux), wrapping `docker compose up -d --build` and `docker compose down`
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md` with real descriptions
- [x] `.gitignore` updates (Python cache, .venv, SQLite db file) - existing .gitignore already covers these; added `.dockerignore`

Tests:
- pytest in `backend/tests/`: `/api/health` returns 200 with expected JSON; `/` returns the static page
- Manual (with user confirmation for Docker): start script builds and runs the container; browser at `http://localhost:8000` shows the hello page with a successful API call; stop script stops it

Success criteria: container starts via script, hello page loads at `/`, page displays live `/api/health` response, pytest green.

## Part 3: Add in Frontend

Statically build the Next.js app and serve it from FastAPI so the demo Kanban board appears at `/`.

Steps:
- [x] Set `output: "export"` in `next.config.ts`; verify `npm run build` produces `out/` (export is production-only so `next dev` keeps full features)
- [x] Add dev-only `rewrites` for `/api/*` to `http://localhost:8000` (used by `next dev`; ignored in export)
- [x] Convert Dockerfile to multi-stage: Node stage builds the frontend export, Python stage copies `out/` into the static dir
- [x] Replace the Part 2 placeholder page with the exported site (in the image; `backend/static/` keeps the placeholder for backend-only local runs, overridable via `STATIC_DIR`)
- [x] Repoint Playwright `webServer` at the backend-served build (`npm run build` then uvicorn with `STATIC_DIR=../frontend/out`) so e2e tests exercise the real serving path
- [x] Update `frontend/AGENTS.md` for the export setup

Tests:
- [x] Existing frontend unit tests (vitest) still pass
- [x] Playwright e2e pass against the backend-served export (this covers `/` serving `index.html` plus `_next/` assets, since the board only renders when the JS bundles load)
- [x] Manual (with user confirmation): rebuilt container; board served at `http://localhost:8000` with `_next` assets 200; login + session verified against the container (drag and drop covered by e2e on the same build artifact)

Note: e2e locally required a workaround - Playwright's bundled archive extractor hangs on this machine, so chromium was installed manually and the config uses `channel: "chromium"` (no headless-shell download).

Success criteria: demo board fully functional at `/` served by FastAPI, all unit/integration/e2e tests green.

## Part 4: Fake user sign in

Login with `user`/`password` required before seeing the board; logout supported.

Steps:
- [x] Backend: `POST /api/login` (validates hardcoded credentials, sets HTTP-only signed session cookie), `POST /api/logout` (clears cookie), `GET /api/me` (returns username or 401). Cookie signing via `itsdangerous` with a `SECRET_KEY` (env var with dev default)
- [x] Frontend: on load, call `/api/me`; show a login form (brand colors, purple submit button) when unauthenticated, the board when authenticated; logout button in the header (`AppShell` gate component)
- [x] Wrong credentials show an inline error

Tests:
- [x] Backend pytest: login success sets cookie; wrong credentials return 401; `/api/me` with/without/with-tampered cookie; logout clears the session (8 passed)
- [x] Frontend vitest: login form renders, submit flow, error display, logout returns to login (fetch mocked) (11 passed)
- [x] Playwright e2e: full flow - visit `/`, see login, sign in, see board, log out, see login again; bad password shows error; session persists across reload (6 passed)

Success criteria: board is unreachable without login; login/logout work end to end in the container; all tests green.

## Part 5: Database modeling

Propose and document the SQLite schema; board stored as JSON.

Steps:
- [x] Write `docs/DATABASE.md`: schema, JSON document shape (mirrors the frontend `BoardData` type: `columns[]` with ordered `cardIds`, `cards` map), seeding strategy, and create-if-missing behavior
- [ ] Proposed schema:
      `users(id INTEGER PK, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL)`
      `boards(id INTEGER PK, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), data TEXT NOT NULL, updated_at TEXT NOT NULL)`
      (UNIQUE on `user_id` enforces one board per user for the MVP; `data` holds the board JSON)
- [x] Seed on first startup: the `user` user plus a default board built from the current demo data (documented; implemented in Part 6)
- [x] User reviews and approves the schema (SIGN-OFF GATE) - approved 2026-06-10

Success criteria: user approves `docs/DATABASE.md`.

## Part 6: Backend board API

API routes to read and change a user's Kanban; DB created if missing.

Steps:
- [x] DB module using stdlib `sqlite3`: create tables and seed on startup (FastAPI lifespan); db path via `DB_PATH`, default `data/pm.db` on a compose volume (`pm-data`)
- [x] Pydantic models mirroring `BoardData` (Card, Column, Board) for validation
- [x] `GET /api/board`: returns the signed-in user's board (auth required)
- [x] `PUT /api/board`: validates and replaces the whole board document (auth required)
- [x] Reject boards that fail validation with 422 (missing cards, duplicated cards, unplaced cards, key/id mismatch)

Tests:
- [x] pytest with a temp db file: fresh-start seeds the db; GET returns seeded board; PUT then GET round-trips; invalid shapes return 422; endpoints 401 without session; data persists across app restarts (16 passed total)

Success criteria: backend test suite green; board CRUD works via curl/httpx against the running container.

## Part 7: Frontend + Backend integration

Frontend uses the API; the board becomes persistent.

Steps:
- [x] `src/lib/api.ts`: typed fetch helpers for login/logout/me/board
- [x] `KanbanBoard` loads the board from `GET /api/board` (loading and load-error states)
- [x] Every mutation (move, rename, add, delete) updates local state optimistically and `PUT`s the full board; "Changes not saved" indicator on failure
- [x] `initialData` no longer used in the UI path (kept in `kanban.ts` as test fixture; backend seeds its own copy)

Tests:
- [x] Frontend vitest: board loads from mocked API; mutations persist expected payloads; load-error and save-error states (13 passed)
- [x] Backend integration covered by Part 6 suite
- [x] Playwright e2e: rename + add card, reload - persists; sign out and back in - persists (7 passed; e2e server uses a throwaway `DB_PATH=data/e2e.db` reset per run, tests run serially)

Success criteria: board state survives page reloads and container restarts; full test suite green.

## Part 8: AI connectivity

Backend can call OpenRouter; prove with a "2+2" test.

Steps:
- [x] Add `openai` SDK; `app/ai.py` creates a client with `base_url="https://openrouter.ai/api/v1"` and the env key; model from `OPENROUTER_MODEL_NAME` default `openai/gpt-oss-120b`
- [x] Minimal completion helper; verify connectivity by asking "What is 2+2? Answer with just the number." and checking for "4"

Tests:
- [x] pytest unit test with the OpenAI client mocked (correct base_url, model, message passing)
- [x] pytest live test marked `live` (default pytest run deselects `live`; run with `uv run pytest -m live`): real call returned "4"

Success criteria: met locally with the real key; container check folds into the final verification.

## Part 9: AI board-aware chat with Structured Outputs

AI receives the board JSON plus the conversation and replies with structured output that may include a board update.

Steps:
- [x] `POST /api/chat` (auth required): body `{message, history: [{role, content}]}`
- [x] System prompt: explain the Kanban schema, embed the user's current board JSON, instruct the model it may create/edit/move/delete one or more cards and rename columns
- [x] Structured Outputs via the SDK's `parse` with a strict schema: `{reply: string, board: AIBoard | null}`. Strict schemas cannot express dict-with-arbitrary-keys, so the AI returns `cards` as a list and the endpoint converts to the `Board` map shape
- [x] When `board` is returned: validate with the Part 6 Pydantic models, save to db, include the updated board in the response; on invalid board, return the reply with a note and do not save

Tests:
- [x] pytest with mocked AI: reply-only; valid board update saved and returned; invalid update not saved and flagged; history forwarded; board JSON in the system prompt; 401 unauthenticated (24 passed)
- [x] Live test marked `live`: "Move the 'Align roadmap themes' card to the Done column" produced a valid updated board with card-1 in Done

Success criteria: mocked suite green; live test demonstrates a real board mutation via AI.

## Part 10: AI chat sidebar UI

Beautiful chat sidebar; AI-driven board updates refresh the UI automatically.

Steps:
- [x] `ChatSidebar` component: collapsible right-hand panel styled with the brand palette (navy headings, blue user bubbles, purple send button, yellow accent line)
- [x] Message list (user/assistant bubbles), input with submit-on-enter, "Thinking..." indicator while the AI responds
- [x] Conversation history kept in component state and sent with each message
- [x] When the chat response includes an updated board, apply it to board state immediately (automatic refresh)
- [x] Update `frontend/AGENTS.md`

Tests:
- [x] Frontend vitest: sidebar opens/closes; messages render with history forwarded; board updates applied via `onBoardUpdate`; null board not applied; error state (18 passed)
- [x] Playwright e2e with `/api/chat` stubbed via route interception: chat reply updates the board in the UI (8 passed)
- [x] Manual live check in the container: real `/api/chat` request created a card in Backlog; updated board returned in the response (which drives the UI auto-refresh) and persisted in the database

Success criteria: full flow works in the Docker container - sign in, chat with the AI, watch the board change; entire test suite green.

## Post-MVP fixes (2026-06-10)

User-reported issues after the initial release, both fixed and verified in the container:

- [x] Cards could not be edited (the demo frontend never had editing). Added an Edit button on each card with an inline title/details form; drag listeners are suspended while editing; persisted like every other mutation. Unit + e2e coverage
- [x] AI assistant failed intermittently. Root cause: OpenRouter providers for `gpt-oss-120b` do not all enforce `response_format` (none declare full structured-output support, so `require_parameters` 404s), and a non-enforcing provider returned malformed JSON, crashing the endpoint with an unhandled 500. Fix: output schema is also spelled out in the system prompt, temperature lowered to 0.2, up to 3 attempts on bad or empty JSON (`AIResponseError`), endpoint logs and returns a friendly reply instead of 500. Failure-path tests added

## Done means

- `scripts/start.ps1` brings up the container; `http://localhost:8000` serves the app
- Login with `user`/`password`; persistent Kanban board; AI sidebar that can modify the board
- All unit, integration, and e2e tests pass; README kept minimal
