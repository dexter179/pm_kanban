# Frontend

Next.js 16 (App Router) + React 19 + TypeScript single-page Kanban board with login and an AI chat sidebar. Styling is Tailwind CSS 4 with brand colors as CSS variables. Drag and drop via dnd-kit. The board is loaded from and persisted to the FastAPI backend (`/api/board`); every mutation optimistically updates state then PUTs the full board.

## Build and serving

- `next.config.ts`: production builds use `output: "export"` (static site in `out/`, served by the FastAPI backend at `/`); `next dev` instead gets `/api/*` rewrites to `http://localhost:8000` so the dev server can talk to a locally running backend
- The repo-root `Dockerfile` builds the export in a Node stage and copies `out/` into the Python image's `static/` dir

## Layout

- `src/app/layout.tsx` - root layout; loads Space Grotesk (display) and Manrope (body) via `next/font`, sets metadata
- `src/app/page.tsx` - renders `AppShell`
- `src/lib/api.ts` - typed fetch helpers: `fetchMe`/`login`/`logout`, `getBoard`/`saveBoard`, `sendChat`
- `src/components/AppShell.tsx` - auth gate: checks `/api/me` on load, shows `LoginForm` or `KanbanBoard`, handles logout
- `src/components/LoginForm.tsx` - branded sign-in card (purple submit), inline error on bad credentials
- `src/components/ChatSidebar.tsx` - collapsible AI assistant panel (floating button bottom-right); keeps conversation history in state, posts to `/api/chat`, and applies returned board updates via `onBoardUpdate`
- `src/app/globals.css` - Tailwind import plus brand palette as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, surfaces, stroke, shadow) and the `.font-display` helper
- `src/lib/kanban.ts` - types and pure logic:
  - `Card {id, title, details}`, `Column {id, title, cardIds}`, `BoardData {columns, cards}` - columns hold ordered `cardIds`; `cards` is a flat id-keyed map
  - `initialData` - demo board: 5 columns (Backlog, Discovery, In Progress, Review, Done), 8 cards
  - `moveCard(columns, activeId, overId)` - pure reorder/move logic handling same-column reorder, cross-column insert, and drop-on-column (appends to end)
  - `createId(prefix)` - random+timestamp id generator
- `src/components/KanbanBoard.tsx` - client component owning board state; loads via `getBoard()` (loading/error states), persists every change via `saveBoard()` with a "Changes not saved" indicator on failure; wires `DndContext` (PointerSensor with 6px activation distance, `closestCorners`), `DragOverlay`, handlers for rename/add/delete/move, header with sign-out, and the `ChatSidebar`
- `src/components/KanbanColumn.tsx` - droppable column (`useDroppable`); column title is an inline `<input>` (rename on change); wraps cards in `SortableContext`; shows a dashed "drop a card here" placeholder when empty; `data-testid="column-<id>"`
- `src/components/KanbanCard.tsx` - sortable card (`useSortable`) with title, details, and Edit/Remove buttons; Edit switches to an inline title/details form (drag attributes/listeners are not spread while editing so the inputs stay interactive); `data-testid="card-<id>"`
- `src/components/KanbanCardPreview.tsx` - static card rendering used inside `DragOverlay`
- `src/components/NewCardForm.tsx` - collapsed "Add a card" button expanding to a title+details form; requires non-empty title

## Tests

- Unit: Vitest + Testing Library, jsdom, setup in `src/test/setup.ts` (jest-dom), config in `vitest.config.ts` (`@` aliases `src/`). Component tests mock `@/lib/api` (board/chat) or global fetch (auth); `initialData` in `kanban.ts` is kept as a fixture
- E2E: Playwright (chromium, serial workers) in `tests/`: auth flow, board CRUD and drag, persistence across reload/re-login, chat with `/api/chat` stubbed via route interception. `playwright.config.ts` builds the static export and serves it through the backend (uvicorn on 127.0.0.1:8000, `STATIC_DIR=../frontend/out`, throwaway `DB_PATH=data/e2e.db` reset per server start). Requires `uv` on PATH. Uses `channel: "chromium"` (see the machine note below)

Machine note: `npx playwright install` hangs during archive extraction on this machine; the browser was installed manually (extract the downloaded zip with `Expand-Archive` into `%LOCALAPPDATA%\ms-playwright\chromium-<rev>` and create an empty `INSTALLATION_COMPLETE` file). `channel: "chromium"` avoids needing the separate headless-shell download

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- `npm run test:unit` / `npm run test:e2e` / `npm run test:all`
