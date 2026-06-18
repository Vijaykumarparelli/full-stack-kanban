# Code Review Report

**Date:** 2026-06-17  
**Reviewer:** Multi-agent review (Backend · Frontend · Infrastructure)  
**Scope:** Full codebase — `backend/`, `frontend/`, `Dockerfile`, `docker-compose.yml`  
**Total findings:** 70

---

## Severity Legend

| Level | Meaning |
|---|---|
| **Critical** | Exploitable now; fix before any public deployment |
| **High** | Significant risk or reliability hazard; fix in the next sprint |
| **Medium** | Meaningful risk or UX degradation; fix within a month |
| **Low** | Minor issue or polish; fix when convenient |
| **Quality** | Code smell / maintainability debt |

---

## Part 1 — Backend (Python / FastAPI)

### Critical

**B-C01 — SHA-256 without salt used for password hashing**  
`auth.py:20`, `database.py:90`  
SHA-256 is a general-purpose hash with no salt and no work factor. It is trivially reversible via GPU brute-force or rainbow tables. Every stored password is at risk if the database is compromised.  
**Fix:** Replace with `passlib[bcrypt]`. Use `CryptContext` so future algorithm upgrades are automatic. Update the seeded user hash on migration.
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(p: str) -> str: return pwd_context.hash(p)
def verify_password(plain: str, hashed: str) -> bool: return pwd_context.verify(plain, hashed)
```

**B-C02 — Hardcoded fallback JWT secret**  
`auth.py:12`  
`os.getenv("JWT_SECRET", "pm-app-secret-key-change-in-prod")` — if the env var is absent, the well-known default is used. Any attacker can forge tokens for any `user_id`.  
**Fix:** Remove the default entirely. Raise at startup if unset:
```python
SECRET_KEY = os.environ["JWT_SECRET"]  # raises KeyError if missing
```

**B-C03 — Hardcoded default database credentials**  
`database.py:6–10`  
`DB_USER` defaults to `"root"`, `DB_PASS` defaults to `"root@123"`. These are embedded in source and will be used in any deployment that omits env vars.  
**Fix:** Remove all credential defaults. Fail fast if unset.

**B-C04 — AI `move_card` action skips target-column ownership check**  
`main.py:360–366`  
The AI handler sets `card.column_id = params["column_id"]` without verifying that the target column belongs to the authenticated user. A prompt-injection attack via a malicious card title could move cards into another user's board.  
**Fix:** Validate that `params["column_id"]` belongs to `user` before applying the change — replicate the ownership join already used in the REST `move_card` endpoint (`main.py:187`).

---

### High

**B-H01 — CORS wildcard combined with `allow_credentials=True`**  
`main.py:27–32`  
`allow_origins=["*"]` with `allow_credentials=True` is rejected by modern browsers but signals maximum permissiveness. The credential flag should be removed since Bearer token auth does not use cookies.  
**Fix:** Set `allow_origins` to an explicit allowlist (deployed frontend domain). Remove `allow_credentials=True`.

**B-H02 — No string length validation on user-supplied inputs**  
`main.py:39–40, 100–101, 122–136`  
`LoginRequest.username`, card `title`, `description`, and column `name` have no length constraints. Arbitrary-length strings are stored in the DB and forwarded to the OpenAI API.  
**Fix:** Use `Annotated[str, Field(max_length=N)]` matching DB column widths.

**B-H03 — `priority` and `card_type` not constrained to valid enum values**  
`main.py:126–128, 176–181`  
Both fields are plain `str`. Any arbitrary value is accepted and persisted.  
**Fix:** Use `Literal` types:
```python
from typing import Literal
priority: Literal["low", "medium", "high", "critical"] = "medium"
card_type: Literal["task", "bug", "issue", "feature", "improvement"] = "task"
```

**B-H04 — Raw exception message returned to client from AI endpoint**  
`main.py:393`  
`f"AI error: {str(e)}"` can expose API URLs, request headers, or partial API key content from `openai.APIError`.  
**Fix:** Log the full exception server-side; return a generic `"An error occurred. Please try again."` to the client.

**B-H05 — No rate limiting on any endpoint**  
`main.py` (all endpoints)  
The `/api/auth/login` endpoint is open to unlimited brute-force. `/api/ai/chat` has no per-user throttle, enabling cost amplification against the OpenRouter API key.  
**Fix:** Add `slowapi` with limits: ~10 req/min on login, ~20 req/min per user on `/ai/chat`.

**B-H06 — Unbounded `history` list in AI chat request**  
`main.py:257–258, 316–318`  
`history: list[dict]` has no length or size limit. A caller can send thousands of messages, driving up token costs and exhausting memory.  
**Fix:** Cap the list: `history: list[dict] = Field(default=[], max_length=50)`. Validate each item contains only `role` and `content` keys with bounded lengths.

**B-H07 — f-string SQL injection risk in `CREATE DATABASE`**  
`database.py:75`  
`f"CREATE DATABASE IF NOT EXISTS \`{DB_NAME}\`"` interpolates an env var directly into raw SQL. A backtick or semicolon in `DB_NAME` could break or exploit the statement.  
**Fix:** Validate `DB_NAME` against `^[a-zA-Z0-9_]+$` at startup and raise if it does not match.

---

### Medium

**B-M01 — No cascade deletes on foreign keys**  
`database.py:30, 39, 49`  
Deleting a user, board, or column leaves orphaned child rows in the database.  
**Fix:** Add `ondelete="CASCADE"` to each `ForeignKey` and `cascade="all, delete-orphan"` to each `relationship()`.

**B-M02 — No indexes on foreign key columns**  
`database.py:30, 39, 49`  
`boards.user_id`, `columns.board_id`, `cards.column_id` are queried on every board load but have no explicit index.  
**Fix:** Add `index=True` to each FK column definition.

**B-M03 — Only the first board is returned; no uniqueness constraint**  
`main.py:92`  
`.first()` silently discards any board beyond the first. The `boards` table has no unique constraint on `user_id`.  
**Fix:** Add `UniqueConstraint("user_id")` to the `boards` table, or expose a board-selection API.

**B-M04 — Incorrect `move_card` position rebalance logic**  
`main.py:203–209`  
`card.position` is written to the session on line 203 before the sibling rebalance runs; then overwritten again on line 209. The intermediate write may trigger DB constraints or leave inconsistent ordering.  
**Fix:** Perform the full rebalance first, then assign `card.column_id` and `card.position` in one step.

**B-M05 — Seed user has well-known credentials**  
`database.py:88–91`  
Username `"user"` / password `"password"` is seeded automatically on first run. Any attacker who knows the codebase can log in immediately.  
**Fix:** Remove the automatic seed. Print a one-time random password to stdout on first run, or require admin setup via a CLI command.

**B-M06 — `"system"` role injectable via history array**  
`main.py:317`  
`msg.get("role", "user")` accepts any role verbatim, including `"system"`. A caller can inject system-level instructions to override the AI prompt.  
**Fix:** Allowlist: only accept `"user"` and `"assistant"` from the history array.

**B-M07 — No security headers on any response**  
`main.py` (no header middleware)  
Responses lack `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, and `Referrer-Policy`.  
**Fix:** Add a FastAPI middleware that sets these headers on every response.

**B-M08 — Static file server has no path traversal guard**  
`main.py:423–430`  
`os.path.join(static_dir, path)` where `path` comes from the URL. A request for `/../auth.py` (or URL-encoded equivalent) could resolve outside `static_dir`.  
**Fix:** After joining, assert the resolved path is within `static_dir`:
```python
real = os.path.realpath(file_path)
assert real.startswith(os.path.realpath(static_dir))
```

**B-M09 — No min/max length on `LoginRequest` fields**  
`main.py:39–41`  
Empty username `""` is accepted; a 10 MB password would be hashed in memory.  
**Fix:** `username: Annotated[str, Field(min_length=1, max_length=150)]`, `password: Annotated[str, Field(min_length=1, max_length=200)]`.

---

### Low

**B-L01 — Token expiry hardcoded; no refresh or revocation**  
`auth.py:14`  
`TOKEN_EXPIRE_HOURS = 24` is a magic constant with no revocation mechanism. Stolen tokens remain valid for 24 hours.  
**Fix:** Read from an env var. Consider short-lived access tokens (15–60 min) with a refresh token flow.

**B-L02 — `or`-default coerces falsy values incorrectly in `card_to_dict`**  
`main.py:62–66`  
`card.priority or "medium"` will coerce an empty string `""` to `"medium"` unexpectedly.  
**Fix:** Use explicit `None` checks: `card.priority if card.priority is not None else "medium"`.

**B-L03 — Password-hashing library absent from `requirements.txt`**  
`requirements.txt`  
`bcrypt` / `argon2-cffi` / `passlib` are not listed. When B-C01 is fixed this will be needed.  
**Fix:** Add `passlib[bcrypt]` and pin the version. Use `pip-tools` or `uv` to generate a lockfile.

**B-L04 — `openai` library imported inside function body**  
`main.py:267–268`  
`from openai import OpenAI` inside `ai_chat()` is non-idiomatic and slightly wasteful on every call.  
**Fix:** Move to the top-level imports.

**B-L05 — Database cursor not closed in `init_db`**  
`database.py:73–77`  
`conn.cursor().execute(...)` creates a cursor that is never explicitly closed.  
**Fix:** Use `with conn.cursor() as cur: cur.execute(...)`.

---

### Quality

**B-Q01 — Board query duplicated three times**  
`main.py:92, 276, 384`  
**Fix:** Extract `def get_user_board(user_id, db) -> Board | None`.

**B-Q02 — Card/column ownership join repeated five times**  
`main.py:150, 169, 194, 338–340, 351–353, 361–363, 369–371`  
**Fix:** Extract `get_user_card(card_id, user_id, db)` and `get_user_column(column_id, user_id, db)`.

**B-Q03 — Missing Pydantic response models**  
`main.py:57, 72`  
Route handlers return untyped `dict` literals. No `response_model` is declared, so OpenAPI docs are incomplete and response shape is not enforced.  
**Fix:** Define `CardOut`, `ColumnOut`, `BoardOut` Pydantic models and declare them on each route.

**B-Q04 — `/docs` and `/redoc` exposed in production**  
`main.py:24`  
FastAPI enables these by default. They expose the full API schema to anyone who can reach the server.  
**Fix:** `FastAPI(docs_url=None, redoc_url=None)` in production (gate with an env var).

**B-Q05 — `hashlib` re-imported and duplicated inside `init_db`**  
`database.py:88–90`  
`hashlib` is imported inside the function rather than at the top of the file, and the password hashing logic duplicates `auth.hash_password`.  
**Fix:** Import at module level; call `auth.hash_password("password")` to avoid duplication.

---

## Part 2 — Frontend (Next.js / React / TypeScript)

### Critical

**F-C01 — JWT stored in `localStorage` (XSS token theft)**  
`api.ts:5`, `auth-context.tsx:28, 40, 47, 53`  
Any JavaScript on the page — including injected scripts from third-party packages — can read `localStorage.getItem("token")` and exfiltrate it.  
**Fix:** Store the token in an `httpOnly; Secure; SameSite=Strict` cookie set by the backend on the login response. Remove all `localStorage` token reads/writes. The `Authorization` header injection in `api.ts:9–14` is then unnecessary.

---

### High

**F-H01 — 401 response does not trigger auth context logout**  
`api.ts:17–19`  
On 401, the token is removed from `localStorage` but the auth context state (`authenticated: true`) is not updated. The UI continues showing the authenticated view until a reload.  
**Fix:** Dispatch a custom DOM event (`window.dispatchEvent(new Event("auth:unauthorized"))`) from `api.ts` on 401/403, and have `AuthProvider` subscribe to it to call `logout()`.

**F-H02 — AI message content is a potential future XSS sink**  
`chat-sidebar.tsx:83–93`  
Messages are rendered as plain text today, which is safe. However the `AIResponse.message` type carries no marker that it must remain plain text. If markdown rendering is ever added, it will likely use `dangerouslySetInnerHTML` with no sanitization.  
**Fix:** Add a JSDoc comment in `types.ts` explicitly marking `message` as plain text only. If markdown is added later, use `react-markdown` with a strict element allowlist, never raw HTML injection.

**F-H03 — All mutation errors are silently swallowed**  
`kanban-board.tsx:142–184`, `backlog.tsx:36–72`  
Every mutating handler (`handleAddCard`, `handleRenameColumn`, `handleSaveCard`, `handleDeleteCard`) catches errors and calls `console.error` only. Users see no feedback when an operation fails.  
**Fix:** Add a local `error` state or toast system. Display an inline error message on failure. Do not close the modal on save failure (see F-M01).

**F-H04 — Fetch failures show empty state instead of error**  
`backlog.tsx:17–30`, `kanban-board.tsx:37–46`  
When `fetchData` fails in `Backlog`, no error state is set; the component renders "No cards found", misleading the user. When `fetchBoard` fails after initial load, stale board data is shown silently.  
**Fix:** Add `error: string | null` state. On fetch failure, set it and render a visible error banner. Reset `board` to `null` on post-load fetch failures so the existing error UI fires.

---

### Medium

**F-M01 — Modal closes before save succeeds; edits lost on failure**  
`kanban-board.tsx:169`, `backlog.tsx:45`  
`setEditingCard(null)` is called before `await fetchBoard()` completes. If `api.updateCard` throws, the modal is already closed and the user loses their in-progress edits.  
**Fix:** Move `setEditingCard(null)` to after the `await fetchBoard()` succeeds. Keep the modal open and show an inline error on failure.

**F-M02 — No rollback on drag-and-drop failure**  
`kanban-board.tsx:115–139`  
Optimistic updates in `onDragOver` are not rolled back if `api.moveCard` fails. The card remains in the wrong column until the re-fetch snaps it back.  
**Fix:** Capture `board` snapshot in `onDragStart`. In the `onDragEnd` catch block, call `setBoard(snapshot)` immediately before the re-fetch.

**F-M03 — No loading state on modal save/delete buttons**  
`card-modal.tsx:13–18, 103–113`  
While a save or delete request is in-flight, both buttons remain active. Double-clicking fires two concurrent API calls for the same card.  
**Fix:** Add `saving` and `deleting` boolean states. Disable buttons while requests are in-flight, consistent with `login/page.tsx`.

**F-M04 — In-place `sort` mutation on state-derived arrays**  
`kanban-board.tsx:213, 227`, `backlog.tsx:65`  
`board.columns.sort(...)` and `column.cards.sort(...)` mutate the arrays in place, which can cause subtle React reconciliation bugs.  
**Fix:** Use spread before sorting: `[...board.columns].sort(...)`, `[...column.cards].sort(...)`.

**F-M05 — Cards not keyboard accessible**  
`sortable-card.tsx:29–57`  
The card `div` is interactive (onClick, drag listeners) but has no `role="button"`, no `tabIndex`, and no `onKeyDown` handler. Keyboard and screen-reader users cannot interact with cards.  
**Fix:** Add `role="button"`, `tabIndex={0}`, and `onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}`. Enable `@dnd-kit`'s `KeyboardSensor`.

**F-M06 — Column rename title not keyboard accessible**  
`kanban-column.tsx:44–49`  
The `<h3>` clickable to enter rename mode has no `role`, `tabIndex`, or keyboard handler.  
**Fix:** Add `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space. Add `aria-label="Rename column"` to the input.

**F-M07 — Card modal missing ARIA roles and focus trap**  
`card-modal.tsx:20–121`  
The modal dialog has no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, and focus is not trapped inside. Screen reader users can tab into the obscured background.  
**Fix:** Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the "Edit Card" heading. Implement focus trapping on mount and move initial focus to the title input.

**F-M08 — Repeated in-render sort during active drag (performance)**  
`kanban-board.tsx:212–238`  
`board.columns.sort(...)` and `column.cards.sort(...)` run on every render, including re-renders triggered by high-frequency drag-over events.  
**Fix:** Wrap in `useMemo`. Use spread copies to avoid in-place mutation.

**F-M09 — Non-null assertions on board state columns**  
`kanban-board.tsx:98–99`  
`srcCol!` and `destCol!` are used without guarding that the columns exist. If board state is inconsistent these will throw a runtime error during drag.  
**Fix:** Replace `!` assertions with explicit null checks and early returns.

---

### Low

**F-L01 — Close button has no accessible label**  
`chat-sidebar.tsx:70`  
The close button renders a literal `x` with no `aria-label`. Screen readers announce "x, button".  
**Fix:** Add `aria-label="Close AI Assistant"`.

**F-L02 — Search input has no accessible label**  
`backlog.tsx:95–100`  
The search input has a `placeholder` but no `<label>` and no `aria-label`.  
**Fix:** Add `aria-label="Search cards"`.

**F-L03 — Drag-event handlers recreated on every render**  
`kanban-board.tsx:68–139`  
`onDragStart`, `onDragOver`, `onDragEnd`, `findCard`, and `findColumnByCardId` are not memoized. During active drag, `onDragOver` fires at pointer frequency.  
**Fix:** Wrap all five in `useCallback` with `board` as a dependency.

**F-L04 — Type casts bypass TypeScript safety**  
`kanban-board.tsx:245, 249`, `sortable-card.tsx:25, 40`, `backlog.tsx:157, 174`  
`(card.priority || "medium") as Priority` and `card.card_type as keyof typeof TYPE_LABELS` appear in 6+ locations. If the API returns an unexpected string the cast silently passes, causing `PRIORITY_COLORS[key]` to return `undefined`.  
**Fix:** Define type-guard helpers in `types.ts` and centralise the fallback logic.

**F-L05 — `parseInt` used without radix**  
`card-modal.tsx:83`  
`parseInt(e.target.value)` should be `parseInt(e.target.value, 10)`.

**F-L06 — Dead `onBoardUpdate` prop**  
`kanban-board.tsx:23`  
`onBoardUpdate?: () => void` is declared in `Props` but never called inside the component or passed from the parent.  
**Fix:** Remove it.

**F-L07 — Loading state flashes on every mutation**  
`kanban-board.tsx:37–46`  
`setLoading(false)` in the `finally` block runs on every post-mutation re-fetch, causing the "Loading board..." spinner to flash after every card add/rename/save/delete.  
**Fix:** Use a separate `initialLoading` flag (only `true` on the very first fetch) vs. a `refreshing` indicator for subsequent fetches.

**F-L08 — Array index used as React key in chat messages**  
`chat-sidebar.tsx:83`  
`key={i}` will cause React to reuse wrong DOM nodes if the message array is ever reordered.  
**Fix:** Assign a monotonically incrementing `id` to each message and use it as the key.

**F-L09 — Search filters by title only, no user hint**  
`backlog.tsx:77`  
Searching a description keyword returns no results with no explanation.  
**Fix:** Expand search to include `card.description` and `card.column_name`, or label the field "Search by title".

**F-L10 — Auth state not synced when `api.ts` removes token on 401**  
`auth-context.tsx:27`, `api.ts:18`  
`api.ts` removes the token from `localStorage` on 401 without calling `logout()`, so `authenticated` stays `true` until a page reload.  
**Fix:** Consolidate token access behind `auth-context.tsx`. Make `api.ts` call an external `onUnauthorized` callback rather than touching `localStorage` directly (ties into F-H01).

---

## Part 3 — Infrastructure (Docker / Config)

### Critical

**I-C01 — Hardcoded database password in `docker-compose.yml`**  
`docker-compose.yml:5, 27`  
`MYSQL_ROOT_PASSWORD: root@123` and `DB_PASS: root@123` are hardcoded in plain text in a file tracked by git. The password is in version history.  
**Fix:** Replace with env var references: `MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}`. Define actual values only in a `.env` file excluded by `.gitignore`. Never commit passwords to source control.

---

### High

**I-H01 — Docker base images not pinned to digest**  
`Dockerfile:2, 10`  
`node:22-alpine` and `python:3.12-slim` are floating tags. Upstream changes can silently alter builds — a supply-chain and reproducibility risk.  
**Fix:** Pin to `SHA-256` digest: `FROM node:22-alpine@sha256:<digest>`.

**I-H02 — MySQL port 3306 exposed on all host interfaces**  
`docker-compose.yml:8`  
`"3306:3306"` binds MySQL to `0.0.0.0`, making the database reachable from external networks on cloud hosts.  
**Fix:** Remove the `ports` binding (the `app` container reaches `db` over the internal Docker network). If local tooling requires it, bind only to localhost: `"127.0.0.1:3306:3306"`.

**I-H03 — Application container runs as root**  
`Dockerfile:9–23`  
No `USER` instruction is present. If the app is compromised, the attacker has full container root.  
**Fix:**
```dockerfile
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser
```

**I-H04 — No `restart` policy on either service**  
`docker-compose.yml` (absent)  
If either container crashes it stays down until manually restarted.  
**Fix:** Add `restart: unless-stopped` to both service definitions.

**I-H05 — No healthcheck on the app service**  
`docker-compose.yml` (absent on `app`)  
Docker cannot detect if the app is deadlocked or refusing connections.  
**Fix:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 10s
  timeout: 5s
  retries: 5
```
Also add a `/health` endpoint to the backend.

---

### Medium

**I-M01 — No security headers configured anywhere**  
`next.config.ts:3–5`, `main.py` (no header middleware)  
Neither the Next.js config nor the FastAPI backend sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy`.  
**Fix:** Add a FastAPI response middleware that injects these headers on every response (both API and static file responses).

**I-M02 — `.gitignore` path anchoring may miss nested artifacts**  
`.gitignore:1–7`  
Paths prefixed with `/` are anchored to the root. `frontend/node_modules` and `frontend/.next` may not be matched. No entries for `__pycache__`, `*.pyc`, or `.venv`.  
**Fix:** Use unanchored patterns: `node_modules/`, `**/.next/`, `**/__pycache__/`, `*.pyc`, `.venv/`.

**I-M03 — Next.js version `16.2.9` does not correspond to any published release**  
`frontend/package.json:15, 25`  
Next.js latest stable is in the 15.x line. Version `16.2.9` does not exist on npm, suggesting a manually edited or fictitious version number.  
**Fix:** Verify with `npm ls next`. Align to the latest stable release and regenerate `package-lock.json`.

**I-M04 — `@types/node` pinned to `^20` while runtime uses Node 22**  
`frontend/package.json:22`, `Dockerfile:2`  
TypeScript will not have type definitions for Node 22-only APIs and may surface type mismatches.  
**Fix:** `"@types/node": "^22"`.

---

### Low

**I-L01 — No Python dependency lockfile**  
`Dockerfile:14`  
`pip install -r requirements.txt` is non-deterministic across builds. Transitive dependency versions can change without notice.  
**Fix:** Use `pip-tools`, `poetry`, or `uv` to generate and commit a fully pinned lockfile. Install from the lockfile in the Dockerfile.

**I-L02 — `npm start` is incompatible with `output: "export"`**  
`frontend/package.json:7`  
`next start` cannot serve a static export from `out/`. Running `npm start` locally will fail or serve nothing.  
**Fix:** Change to `"start": "npx serve out"` or add a `"serve": "npx serve out"` script.

---

### Quality

**I-Q01 — `tsconfig.json` target set to ES2017**  
`frontend/tsconfig.json:3`  
Unnecessary down-compilation for a Node 22 / modern-browser target. Increases bundle size.  
**Fix:** Set `"target": "ES2022"` or `"ESNext"`.

**I-Q02 — Missing strict TypeScript checks**  
`frontend/tsconfig.json`  
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are disabled even though `strict: true` is set.  
**Fix:** Add to `compilerOptions`:
```json
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true
```

**I-Q03 — `eslint` script has no target files**  
`frontend/package.json:9`  
`"lint": "eslint"` with no arguments lints nothing. CI lint check is a no-op.  
**Fix:** `"lint": "next lint"` (Next.js's built-in ESLint wrapper).

---

## Summary Table

| ID | Severity | Layer | File | Description |
|---|---|---|---|---|
| B-C01 | Critical | Backend | `auth.py:20` | SHA-256 without salt for passwords |
| B-C02 | Critical | Backend | `auth.py:12` | Hardcoded fallback JWT secret |
| B-C03 | Critical | Backend | `database.py:6–10` | Hardcoded default DB credentials |
| B-C04 | Critical | Backend | `main.py:360–366` | AI move_card skips ownership check |
| B-H01 | High | Backend | `main.py:27–32` | CORS wildcard + allow_credentials |
| B-H02 | High | Backend | `main.py:39–136` | No input length validation |
| B-H03 | High | Backend | `main.py:126–181` | priority/card_type not enum-validated |
| B-H04 | High | Backend | `main.py:393` | Raw exception message returned to client |
| B-H05 | High | Backend | `main.py` | No rate limiting |
| B-H06 | High | Backend | `main.py:257–318` | Unbounded history list in AI chat |
| B-H07 | High | Backend | `database.py:75` | f-string SQL injection in CREATE DATABASE |
| B-M01 | Medium | Backend | `database.py:30,39,49` | No cascade deletes |
| B-M02 | Medium | Backend | `database.py:30,39,49` | No FK indexes |
| B-M03 | Medium | Backend | `main.py:92` | Only first board returned |
| B-M04 | Medium | Backend | `main.py:203–209` | Incorrect move_card position rebalance |
| B-M05 | Medium | Backend | `database.py:88–91` | Seed user with well-known credentials |
| B-M06 | Medium | Backend | `main.py:317` | system role injectable via history |
| B-M07 | Medium | Backend | `main.py` | No security headers |
| B-M08 | Medium | Backend | `main.py:423–430` | Path traversal in static file server |
| B-M09 | Medium | Backend | `main.py:39–41` | No min/max on LoginRequest fields |
| B-L01 | Low | Backend | `auth.py:14` | Token expiry hardcoded, no revocation |
| B-L02 | Low | Backend | `main.py:62–66` | or-default coerces falsy incorrectly |
| B-L03 | Low | Backend | `requirements.txt` | Missing password-hashing library |
| B-L04 | Low | Backend | `main.py:267–268` | openai import inside function body |
| B-L05 | Low | Backend | `database.py:73–77` | Cursor not closed in init_db |
| B-Q01 | Quality | Backend | `main.py:92,276,384` | Board query duplicated three times |
| B-Q02 | Quality | Backend | `main.py` multiple | Ownership join pattern repeated five times |
| B-Q03 | Quality | Backend | `main.py:57,72` | Missing Pydantic response models |
| B-Q04 | Quality | Backend | `main.py:24` | /docs and /redoc exposed in production |
| B-Q05 | Quality | Backend | `database.py:88–90` | hashlib re-imported inside init_db |
| F-C01 | Critical | Frontend | `api.ts:5` | JWT in localStorage (XSS token theft) |
| F-H01 | High | Frontend | `api.ts:17–19` | 401 does not trigger auth context logout |
| F-H02 | High | Frontend | `chat-sidebar.tsx:83` | AI message future XSS sink |
| F-H03 | High | Frontend | `kanban-board.tsx` | Mutation errors silently swallowed |
| F-H04 | High | Frontend | `backlog.tsx:17–30` | Fetch failure shows empty state not error |
| F-M01 | Medium | Frontend | `kanban-board.tsx:169` | Modal closes before save succeeds |
| F-M02 | Medium | Frontend | `kanban-board.tsx:115–139` | No rollback on drag-and-drop failure |
| F-M03 | Medium | Frontend | `card-modal.tsx:103–113` | No loading state on modal buttons |
| F-M04 | Medium | Frontend | `kanban-board.tsx:213,227` | In-place sort mutation |
| F-M05 | Medium | Frontend | `sortable-card.tsx` | Cards not keyboard accessible |
| F-M06 | Medium | Frontend | `kanban-column.tsx:44–49` | Column rename not keyboard accessible |
| F-M07 | Medium | Frontend | `card-modal.tsx:20–121` | Modal missing ARIA roles and focus trap |
| F-M08 | Medium | Frontend | `kanban-board.tsx:212–238` | In-render sort on drag events |
| F-M09 | Medium | Frontend | `kanban-board.tsx:98–99` | Non-null assertions on board columns |
| F-L01 | Low | Frontend | `chat-sidebar.tsx:70` | Close button no aria-label |
| F-L02 | Low | Frontend | `backlog.tsx:95–100` | Search input no label |
| F-L03 | Low | Frontend | `kanban-board.tsx:68–139` | Drag handlers not memoized |
| F-L04 | Low | Frontend | multiple | Type casts bypass TS safety |
| F-L05 | Low | Frontend | `card-modal.tsx:83` | parseInt without radix |
| F-L06 | Low | Frontend | `kanban-board.tsx:23` | Dead onBoardUpdate prop |
| F-L07 | Low | Frontend | `kanban-board.tsx:37–46` | Loading flash on every mutation |
| F-L08 | Low | Frontend | `chat-sidebar.tsx:83` | Array index as React key |
| F-L09 | Low | Frontend | `backlog.tsx:77` | Search filters title only |
| F-L10 | Low | Frontend | `auth-context.tsx:27` | Auth state not synced on 401 |
| I-C01 | Critical | Infra | `docker-compose.yml:5,27` | Hardcoded DB password in git-tracked file |
| I-H01 | High | Infra | `Dockerfile:2,10` | Docker images not pinned to digest |
| I-H02 | High | Infra | `docker-compose.yml:8` | MySQL port exposed on all interfaces |
| I-H03 | High | Infra | `Dockerfile:9–23` | App container runs as root |
| I-H04 | High | Infra | `docker-compose.yml` | No restart policy |
| I-H05 | High | Infra | `docker-compose.yml` | No healthcheck on app service |
| I-M01 | Medium | Infra | `next.config.ts` | No security headers anywhere |
| I-M02 | Medium | Infra | `.gitignore` | Anchored gitignore may miss nested artifacts |
| I-M03 | Medium | Infra | `package.json:15,25` | Next.js version 16.2.9 not a real release |
| I-M04 | Medium | Infra | `package.json:22` | @types/node ^20 vs Node 22 runtime |
| I-L01 | Low | Infra | `Dockerfile:14` | No Python dependency lockfile |
| I-L02 | Low | Infra | `package.json:7` | npm start incompatible with static export |
| I-Q01 | Quality | Infra | `tsconfig.json:3` | tsconfig target ES2017 |
| I-Q02 | Quality | Infra | `tsconfig.json` | Missing strict TS checks |
| I-Q03 | Quality | Infra | `package.json:9` | eslint script has no target |

---

## Remediation Priority

### Fix immediately (before any public deployment)

1. **B-C01** — Replace SHA-256 with bcrypt
2. **B-C02** — Remove JWT secret fallback default
3. **B-C03** — Remove DB credential defaults from source
4. **I-C01** — Remove hardcoded password from `docker-compose.yml`; use `.env`
5. **F-C01** — Move JWT from localStorage to httpOnly cookie
6. **B-C04** — Add ownership check to AI `move_card` action
7. **B-M08** — Fix path traversal in static file server

### Fix this sprint (High severity)

8. **B-H01** — Restrict CORS origins; remove `allow_credentials`
9. **B-H05** — Add rate limiting to login and AI endpoints
10. **B-H07** — Validate `DB_NAME` before f-string SQL
11. **F-H01** — Wire 401 response to auth context logout
12. **F-H03** / **F-H04** — Surface mutation and fetch errors to users
13. **I-H02** — Remove MySQL port binding from docker-compose
14. **I-H03** — Add non-root user to Dockerfile
15. **I-H04** / **I-H05** — Add restart policy and app healthcheck

### Fix within a month (Medium severity)

- **B-M01/M02** — Add cascade deletes and FK indexes
- **B-M05** — Remove or harden seed user credentials
- **B-M06** — Allowlist history message roles
- **B-M07** / **I-M01** — Add security headers middleware
- **F-M01** — Fix modal close-before-save bug
- **F-M05/M06/M07** — Accessibility: keyboard nav and ARIA roles
- **I-M02** — Fix `.gitignore` anchoring

---

*Report generated by multi-agent review — Backend Agent · Frontend Agent · Infrastructure Agent*
