# Code Review

Full-repo review covering backend, frontend, tests, Docker, and scripts. Date: 2026-06-11.

Remediation status (same day): finding 1 was investigated and retracted as a false positive (see below); findings 2, 3, and 4 are fixed. Full test suite green after the changes: backend 28 passed, frontend lint clean, 20 unit tests passed, 9 e2e tests passed.

## Summary

The codebase is in good shape for an MVP: clear separation of concerns, a single well-validated board document shared by both sides, solid test coverage (backend API, frontend units, e2e through the real serving path), and sensible AI failure handling that never 500s. The findings below are ordered by priority; only the first needs prompt attention.

## High

### 1. `httpx2` dev dependency - RETRACTED (false positive, verified legitimate)

The original review flagged `httpx2` as a likely typosquat of `httpx` (similar name, recent upload, nothing in the repo imports it directly). That was wrong. Verification during remediation proved it legitimate:

- The dependency was swapped to `httpx` in a clean venv rebuild, and the test run then emitted `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` - from starlette's own code, installed fresh from PyPI.
- Starlette 1.2.1's `testclient.py` does `import httpx2 as httpx` by preference and falls back to plain `httpx` only with that deprecation warning. A typosquatter cannot modify starlette's source, so `httpx2` is the genuine successor package (the coordinated same-minute uploads of `httpx2`/`httpcore2` were a normal joint release, matching how `httpx`/`httpcore` always released together).

Resolution: `httpx2` restored in `backend/pyproject.toml` (re-lock picked up v2.4.0), and the deprecation warning is gone from the test run. `backend/AGENTS.md` now notes why the dependency is `httpx2`.

## Medium

### 2. Session secret falls back to a published default - FIXED

`backend/app/auth.py:13` uses `SECRET_KEY` with default `"dev-secret-change-me"`, and `docker-compose.yml` does not set `SECRET_KEY` (the env file only carries the OpenRouter vars). The deployed container therefore signs session cookies with a secret that is committed to the repo, so anyone who can reach port 8000 can forge a valid session for `user`. Low impact while this runs only on localhost, but it silently undermines the signing.

Resolution: `auth.py` now signs with `os.environ.get("SECRET_KEY") or secrets.token_hex(32)` - a random per-process secret when the env var is absent, so cookies are never signed with a committed value. Sessions reset on restart unless `SECRET_KEY` is set in `../.env`, which is fine for the MVP.

### 3. Column rename PUTs the whole board on every keystroke, and saves can land out of order - FIXED

`KanbanColumn.tsx:46` calls `onRename` on each `onChange`, and `applyChange` (`KanbanBoard.tsx:43`) fires `saveBoard` immediately on every mutation. Typing a 10-character column name issues 10 whole-board PUTs. Because the requests are not serialized, responses can complete out of order and an older board can overwrite a newer one server-side (the optimistic UI hides this until the next reload). The same applies to rapid drag/add/delete sequences.

Resolution: `KanbanBoard.tsx` now routes all saves through a latest-write-wins queue (`queueSave`): at most one PUT is in flight, and boards produced while a save is running coalesce into a single follow-up PUT of the newest state. This removes the out-of-order overwrite risk and collapses per-keystroke renames into a few requests.

### 4. SQLite connections are never closed - FIXED

`backend/app/db.py` opens a new connection per call and uses `with connect() as conn:`, but sqlite3's context manager only manages the transaction - it does not close the connection. Cleanup currently relies on garbage collection, which is fragile (and on Windows can hold the database file open).

Resolution: `db.py` now wraps every connection in `contextlib.closing` - `with closing(connect()) as conn, conn:` for writes (`init_db`, `save_board`) and `with closing(connect()) as conn:` for the read in `get_board`.

## Low

### 5. `get_board` 500s and `save_board` silently no-ops for an unknown user

`db.py:110` does `row["data"]` without checking `row is None`, and the `UPDATE` in `save_board` matches zero rows for a username not in the DB. Unreachable today (the only signable username is seeded), but it becomes a real path the moment finding 2's forged-cookie scenario or a second user exists. Cheapest fix: in `current_user`, treat a username that is not in the DB as not signed in, which protects both functions at once. Fine to defer.

### 6. `fetchMe` rejection is unhandled in AppShell

`AppShell.tsx:12` chains `.then(setUser).finally(...)` with no `.catch`. If the backend is unreachable, `fetch` rejects and the browser logs an unhandled rejection. The UI still recovers (the `finally` clears `checking` and the login form renders), so this is cosmetic. Action: add `.catch(() => setUser(null))`.

### 7. Unbounded chat history

`ChatSidebar.tsx` sends the full conversation on every turn and the backend forwards it all to the model along with the board JSON. A long session grows tokens (cost, latency, eventual context overflow). Action: cap the history client-side (e.g. last 20 turns) or server-side in `ai.chat`.

### 8. Dead/duplicated scaffolding code

- `ai.ask()` (`backend/app/ai.py:64`) is unused by the app - only its own tests exercise it. Part 4 scaffolding; per the keep-it-simple rule, remove it together with `test_ask_uses_openrouter_and_model` and `test_live_two_plus_two`, or keep it deliberately as a connectivity smoke test (it is the only `-m live` test that works without a board).
- `initialData` (`frontend/src/lib/kanban.ts:18`) is used only by `KanbanBoard.test.tsx` and is the third copy of the seed board (with `db.DEFAULT_BOARD` and the test stub). Move it into the test file as a fixture so production code stops carrying demo data.

### 9. Docker hardening niceties

The container runs as root and has no `HEALTHCHECK`. For a local single-user MVP this is acceptable; if it ever moves beyond localhost, add a non-root `USER` and a healthcheck hitting `/api/health`.

### 10. E2E database is only reset when the web server is restarted

`playwright.config.ts` deletes `e2e.db` in the `webServer` command but sets `reuseExistingServer: true`, so repeated runs against an already-running server accumulate state (renamed columns, added cards). The current specs are written to tolerate this, but it is an easy trap for new tests. Action: none required now; keep it in mind when adding e2e specs, or reset the board via `PUT /api/board` in a `beforeEach` if it starts to bite.

## Observations (no action needed)

- Session cookie: `httponly` and `samesite=lax` are set; `secure` is correctly omitted for plain-HTTP localhost. SameSite=Lax plus JSON-only endpoints is adequate CSRF protection for this MVP.
- The plaintext `password` column is never read by login (auth checks hardcoded constants). This is documented as deliberate in `docs/DATABASE.md` - revisit when real sign-up arrives.
- `backend/data/` and `.pytest_cache/` exist locally but are correctly gitignored; no secrets or databases are committed.
- `test_health.py`/`test_auth.py` create `TestClient(app)` without the context manager, so the lifespan (`init_db`) never runs. Works because those endpoints never touch the DB, but use the `temp_db` + context-manager pattern from `test_board.py` for any new test that might.
- Board validation (`models.py`) is tight and well-tested: placement exactly-once, key/id match, and the AI list-to-map conversion path is covered including the invalid-update fallback.
- Docs (`AGENTS.md` files, `DATABASE.md`, `CLAUDE.md`) accurately match the code as reviewed.

## Remaining work

Findings 1-4 are resolved (1 retracted, 2-4 fixed and verified by the full test suite). The low-priority items (findings 5-10) remain open and can be batched in one small pass when convenient.
