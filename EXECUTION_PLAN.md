# Execution Plan - Project Management MVP

## Current State Analysis

**What exists:**
- `AGENTS.md` - Full business requirements and technical decisions
- `docs/PLAN.md` - 10 high-level phases (no detailed substeps yet)
- `.env` - OpenRouter API key configured
- `.gitignore` - Standard Node ignores

**What does NOT exist yet:**
- `frontend/` directory (AGENTS.md references it but it is missing)
- `backend/` directory
- `scripts/` directory
- `Dockerfile` or `docker-compose.yml`
- No code at all

**Key technical decisions from AGENTS.md:**
- NextJS frontend (static export)
- Python FastAPI backend serving the static site
- SQLite database (auto-create if missing)
- Docker container for everything
- OpenRouter AI with model `openai/gpt-oss-120b:free`
- Hardcoded auth ("user" / "password") for MVP
- One board per user for MVP

---

## Phase 1: Plan Finalization

| Step | Task | Deliverable |
|------|------|-------------|
| 1.1 | Enrich `docs/PLAN.md` with detailed substeps, checklists, tests, success criteria for each of the 10 parts | Updated `docs/PLAN.md` |
| 1.2 | Create `frontend/AGENTS.md` describing existing frontend code | `frontend/AGENTS.md` |
| 1.3 | Get user approval on the plan | User sign-off |

**Blocker:** The frontend directory does not exist. Need to either scaffold it first or clarify with user whether a starter codebase should be created.

---

## Phase 2: Scaffolding (Docker + Backend + Scripts)

| Step | Task | Deliverable |
|------|------|-------------|
| 2.1 | Create `backend/` with FastAPI app (`main.py`, `requirements.txt`) | Backend hello world |
| 2.2 | Add `/api/health` endpoint returning `{"status": "ok"}` | Health check API |
| 2.3 | Serve a static `index.html` hello world from FastAPI | Static serving proof |
| 2.4 | Create `Dockerfile` (multi-stage: build frontend + run backend) | Dockerfile |
| 2.5 | Create `docker-compose.yml` (port 8000, mount .env) | docker-compose.yml |
| 2.6 | Create `scripts/start.sh`, `scripts/stop.sh` (Mac/Linux) | Shell scripts |
| 2.7 | Create `scripts/start.bat`, `scripts/stop.bat` (Windows) | Batch scripts |
| 2.8 | Test: container starts, serves HTML at `/`, API at `/api/health` | Passing manual tests |

**Success:** `curl localhost:8000/` returns HTML, `curl localhost:8000/api/health` returns JSON.

---

## Phase 3: Frontend Integration

| Step | Task | Deliverable |
|------|------|-------------|
| 3.1 | Create NextJS app in `frontend/` (or use existing if provided) | NextJS project |
| 3.2 | Build Kanban board UI with columns and draggable cards | Kanban components |
| 3.3 | Configure `next.config.js` with `output: 'export'` for static build | Static export config |
| 3.4 | Update Dockerfile to `npm run build` and copy to backend static dir | Updated Dockerfile |
| 3.5 | Update FastAPI to serve built frontend at `/` | Updated backend |
| 3.6 | Write frontend unit tests (Jest / React Testing Library) | Test suite |
| 3.7 | Write integration test: static build serves and renders | Integration test |

**Success:** Demo Kanban board visible and interactive at `localhost:8000/`.

---

## Phase 4: Authentication

| Step | Task | Deliverable |
|------|------|-------------|
| 4.1 | Create login page (username, password, submit button) | Login component |
| 4.2 | Add `POST /api/auth/login` - validates hardcoded creds, returns JWT | Auth endpoint |
| 4.3 | Add `POST /api/auth/logout` and `GET /api/auth/me` | Auth endpoints |
| 4.4 | Frontend stores JWT, sends with all API requests | Auth client logic |
| 4.5 | Protect Kanban route - redirect to login if unauthenticated | Route guard |
| 4.6 | Add logout button to Kanban header | UI update |
| 4.7 | Style login page with project color scheme | Styled login |
| 4.8 | Backend unit tests for all auth endpoints | pytest tests |
| 4.9 | Frontend unit tests for login component | Jest tests |

**Success:** Must log in to see Kanban. Wrong credentials rejected. Logout works.

---

## Phase 5: Database Modeling

| Step | Task | Deliverable |
|------|------|-------------|
| 5.1 | Design SQLite schema: `users`, `boards`, `columns`, `cards` | Schema design |
| 5.2 | Save schema as `docs/schema.json` | Schema file |
| 5.3 | Document DB approach in `docs/DATABASE.md` (schema, migrations, seeding) | Documentation |
| 5.4 | Get user approval on schema | User sign-off |

**Schema outline:**
- `users`: id, username, password_hash
- `boards`: id, user_id, name
- `columns`: id, board_id, name, position
- `cards`: id, column_id, title, description, position

**Success:** Schema documented, approved by user.

---

## Phase 6: Backend CRUD API

| Step | Task | Deliverable |
|------|------|-------------|
| 6.1 | Set up SQLite connection with auto-create | DB initialization |
| 6.2 | Seed default data on first run (user, board, default columns) | DB seeding |
| 6.3 | `GET /api/board` - returns board with nested columns and cards | Read endpoint |
| 6.4 | `PUT /api/columns/{id}` - rename column | Column endpoint |
| 6.5 | `POST /api/cards` - create card | Card endpoint |
| 6.6 | `PUT /api/cards/{id}` - update card | Card endpoint |
| 6.7 | `PUT /api/cards/{id}/move` - move card between columns | Card endpoint |
| 6.8 | `DELETE /api/cards/{id}` - delete card | Card endpoint |
| 6.9 | All endpoints require auth (return 401 without JWT) | Auth middleware |
| 6.10 | pytest unit tests for all endpoints | Test suite |

**Success:** All CRUD operations work, auth enforced, tests pass.

---

## Phase 7: Frontend-Backend Integration

| Step | Task | Deliverable |
|------|------|-------------|
| 7.1 | Create API client/service layer in frontend | API service |
| 7.2 | Replace mock data with real API calls | Connected frontend |
| 7.3 | Wire drag-and-drop to `PUT /api/cards/{id}/move` | DnD integration |
| 7.4 | Wire column rename to `PUT /api/columns/{id}` | Column integration |
| 7.5 | Wire card create/edit/delete to respective endpoints | Card integration |
| 7.6 | Add loading states and error handling | UX polish |
| 7.7 | Integration test: full CRUD flow end-to-end | E2E test |
| 7.8 | Test data persistence across page reloads and container restarts | Persistence test |

**Success:** Kanban is fully persistent. All operations go through real API.

---

## Phase 8: AI Connectivity

| Step | Task | Deliverable |
|------|------|-------------|
| 8.1 | Install `openai` Python SDK in backend | Dependency |
| 8.2 | Create OpenRouter client (base URL override, API key from .env) | AI client |
| 8.3 | Add `POST /api/ai/test` - sends "What is 2+2?" to AI | Test endpoint |
| 8.4 | Unit test verifying AI connectivity | pytest test |

**Success:** `/api/ai/test` returns a response containing "4".

---

## Phase 9: AI Structured Outputs

| Step | Task | Deliverable |
|------|------|-------------|
| 9.1 | Define structured output schema (message + optional board actions) | Schema definition |
| 9.2 | Write system prompt: AI receives board JSON, conversation history, user message | System prompt |
| 9.3 | Add `POST /api/ai/chat` endpoint | Chat endpoint |
| 9.4 | Parse AI structured output and apply actions to database | Action handler |
| 9.5 | Return AI message + updated board state | Response format |
| 9.6 | Backend tests with mocked AI responses | pytest tests |
| 9.7 | Test action parsing (create/move/edit/delete cards, rename columns) | Action tests |
| 9.8 | Test conversation history handling | History tests |

**Action schema:**
```
{
  "message": "AI response text",
  "actions": [
    { "type": "create_card|move_card|edit_card|delete_card|rename_column", "params": {...} }
  ]
}
```

**Success:** AI reads Kanban state, responds conversationally, and modifies board via structured actions.

---

## Phase 10: AI Chat Sidebar UI

| Step | Task | Deliverable |
|------|------|-------------|
| 10.1 | Create collapsible sidebar component (right side) | Sidebar component |
| 10.2 | Chat message list with user/AI bubbles | Message list |
| 10.3 | Text input with send button | Chat input |
| 10.4 | Loading indicator during AI response | UX polish |
| 10.5 | Style with project colors (blue user msgs, navy header, purple send btn) | Themed UI |
| 10.6 | Connect to `POST /api/ai/chat` | API integration |
| 10.7 | Auto-refresh Kanban when AI returns board actions | Live updates |
| 10.8 | Show notification when board is updated by AI | Update indicator |
| 10.9 | Maintain conversation history in frontend state | State management |
| 10.10 | Frontend tests for sidebar | Jest tests |

**Success:** Functional AI chat sidebar that reads and modifies the Kanban board in real time.

---

## Dependencies and Order

```
Phase 1 (Plan)
  |
Phase 2 (Scaffolding)
  |
Phase 3 (Frontend)
  |
Phase 4 (Auth)
  |
Phase 5 (DB Schema)
  |
Phase 6 (Backend API)
  |
Phase 7 (Integration)
  |
Phase 8 (AI Connectivity)
  |
Phase 9 (AI Structured Outputs)
  |
Phase 10 (AI Chat Sidebar)
```

All phases are sequential. Each depends on the previous.

---

## Open Questions

1. **Frontend starter code:** AGENTS.md says "A working MVP of the frontend has been built and is already in frontend" but no `frontend/` directory exists. Need to clarify: should we build the frontend from scratch or is there code to be provided?
2. **SQLite persistence in Docker:** Should we use a Docker volume to persist the SQLite DB file across container restarts?
3. **Default Kanban columns:** Assumed "To Do", "In Progress", "Done" -- confirm with user.
