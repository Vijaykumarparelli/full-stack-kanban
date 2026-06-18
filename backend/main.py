import json
import logging
import mimetypes
import os
import re
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from database import Board, BoardColumn, Card, User, get_db, init_db
from auth import (
    TOKEN_EXPIRE_HOURS,
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


IS_PROD = os.getenv("ENV", "dev") != "dev"
app = FastAPI(
    lifespan=lifespan,
    docs_url=None if IS_PROD else "/docs",
    redoc_url=None if IS_PROD else "/redoc",
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:8000,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    )
    return response


router = APIRouter(prefix="/api")


# --- Request models ---

class LoginRequest(BaseModel):
    username: Annotated[str, Field(min_length=1, max_length=150)]
    password: Annotated[str, Field(min_length=1, max_length=200)]


class RenameColumnRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]


class CreateCardRequest(BaseModel):
    column_id: int
    title: Annotated[str, Field(min_length=1, max_length=300)]
    description: str = ""
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    card_type: Literal["task", "bug", "issue", "feature", "improvement"] = "task"
    points: int = Field(default=0, ge=0, le=100)


class UpdateCardRequest(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=300)]
    description: Annotated[str, Field(max_length=2000)] = ""
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    card_type: Literal["task", "bug", "issue", "feature", "improvement"] = "task"
    points: int = Field(default=0, ge=0, le=100)


class MoveCardRequest(BaseModel):
    column_id: int
    position: int


class AIChatRequest(BaseModel):
    message: Annotated[str, Field(min_length=1, max_length=2000)]
    history: list[dict] = Field(default=[], max_length=50)


# --- Helpers ---

def card_to_dict(card: Card) -> dict:
    return {
        "id": card.id,
        "column_id": card.column_id,
        "title": card.title,
        "description": card.description or "",
        "position": card.position,
        "priority": card.priority if card.priority is not None else "medium",
        "card_type": card.card_type if card.card_type is not None else "task",
        "points": card.points if card.points is not None else 0,
    }


def board_to_dict(board: Board) -> dict:
    return {
        "id": board.id,
        "user_id": board.user_id,
        "name": board.name,
        "columns": [
            {
                "id": col.id,
                "board_id": col.board_id,
                "name": col.name,
                "position": col.position,
                "cards": [card_to_dict(card) for card in col.cards],
            }
            for col in board.columns
        ],
    }


def _get_user_board(user_id: int, db: Session):
    return db.query(Board).filter(Board.user_id == user_id).first()


def _get_user_card(card_id: int, user_id: int, db: Session):
    return (
        db.query(Card)
        .join(BoardColumn, Card.column_id == BoardColumn.id)
        .join(Board, BoardColumn.board_id == Board.id)
        .filter(Card.id == card_id, Board.user_id == user_id)
        .first()
    )


def _get_user_column(column_id: int, user_id: int, db: Session):
    return (
        db.query(BoardColumn)
        .join(Board, BoardColumn.board_id == Board.id)
        .filter(BoardColumn.id == column_id, Board.user_id == user_id)
        .first()
    )


# --- Auth endpoints ---

@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    req: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    # Upgrade legacy SHA-256 hash to bcrypt on first successful login
    if not (user.password_hash.startswith("$2b$") or user.password_hash.startswith("$2a$")):
        user.password_hash = hash_password(req.password)
        db.commit()
    token = create_token(user.id)
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # set True in production
        max_age=TOKEN_EXPIRE_HOURS * 3600,
    )
    return {"username": user.username}


@router.get("/auth/me")
async def me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username}


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("token", samesite="lax")
    return {"message": "Logged out"}


@router.get("/health")
async def health():
    return {"status": "ok"}


# --- Board ---

@router.get("/board")
def get_board(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = _get_user_board(user.id, db)
    if not board:
        raise HTTPException(status_code=404, detail="No board found")
    return board_to_dict(board)


# --- Columns ---

@router.put("/columns/{column_id}")
def rename_column(
    column_id: int,
    req: RenameColumnRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = _get_user_column(column_id, user.id, db)
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    col.name = req.name
    db.commit()
    db.refresh(col)
    return {"id": col.id, "board_id": col.board_id, "name": col.name, "position": col.position}


# --- Cards ---

@router.post("/cards", status_code=201)
def create_card(
    req: CreateCardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = _get_user_column(req.column_id, user.id, db)
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    max_pos = max((c.position for c in col.cards), default=-1)
    card = Card(
        column_id=req.column_id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        card_type=req.card_type,
        points=req.points,
        position=max_pos + 1,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card_to_dict(card)


@router.put("/cards/{card_id}")
def update_card(
    card_id: int,
    req: UpdateCardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _get_user_card(card_id, user.id, db)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    card.title = req.title
    card.description = req.description
    card.priority = req.priority
    card.card_type = req.card_type
    card.points = req.points
    db.commit()
    db.refresh(card)
    return card_to_dict(card)


@router.put("/cards/{card_id}/move")
def move_card(
    card_id: int,
    req: MoveCardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _get_user_card(card_id, user.id, db)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    target_col = _get_user_column(req.column_id, user.id, db)
    if not target_col:
        raise HTTPException(status_code=404, detail="Target column not found")

    # Get all cards in destination column except the moved card
    other_cards = (
        db.query(Card)
        .filter(Card.column_id == req.column_id, Card.id != card_id)
        .order_by(Card.position)
        .all()
    )
    # Insert moved card at requested position
    dest_pos = max(0, min(req.position, len(other_cards)))
    other_cards.insert(dest_pos, card)
    # Assign sequential positions
    for i, c in enumerate(other_cards):
        c.position = i
    card.column_id = req.column_id
    db.commit()
    db.refresh(card)
    return card_to_dict(card)


@router.get("/cards")
def get_all_cards(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all cards for the user's board (for backlog view)."""
    board = _get_user_board(user.id, db)
    if not board:
        return []
    cards = (
        db.query(Card)
        .join(BoardColumn)
        .filter(BoardColumn.board_id == board.id)
        .order_by(Card.position)
        .all()
    )
    result = []
    for card in cards:
        d = card_to_dict(card)
        d["column_name"] = card.column.name
        result.append(d)
    return result


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _get_user_card(card_id, user.id, db)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()


# --- AI Chat ---

@router.post("/ai/chat")
@limiter.limit("20/minute")
async def ai_chat(
    request: Request,
    req: AIChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)

    board = _get_user_board(user.id, db)
    board_json = json.dumps(board_to_dict(board)) if board else "{}"

    system_prompt = f"""You are an AI assistant for a Kanban board project management app.
The user's current board state is:
{board_json}

You can help the user by responding conversationally AND optionally modifying their board.

IMPORTANT: Always respond with valid JSON in this exact format:
{{
  "message": "Your conversational response to the user",
  "actions": [
    {{
      "type": "create_card",
      "params": {{"column_id": <int>, "title": "<string>", "description": "<string>"}}
    }},
    {{
      "type": "edit_card",
      "params": {{"card_id": <int>, "title": "<string>", "description": "<string>"}}
    }},
    {{
      "type": "move_card",
      "params": {{"card_id": <int>, "column_id": <int>, "position": <int>}}
    }},
    {{
      "type": "delete_card",
      "params": {{"card_id": <int>}}
    }},
    {{
      "type": "rename_column",
      "params": {{"column_id": <int>, "name": "<string>"}}
    }}
  ]
}}

Only include actions if the user is asking you to modify the board. The actions array can be empty.
Respond ONLY with the JSON object, no markdown, no extra text."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in req.history:
        role = msg.get("role", "user")
        if role not in ("user", "assistant"):
            role = "user"
        content = str(msg.get("content", ""))[:2000]
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.message})

    try:
        ai_response = client.chat.completions.create(
            model="openai/gpt-oss-120b:free",
            messages=messages,
        )
        content = ai_response.choices[0].message.content.strip()

        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            return {"message": content, "actions": [], "board": board_to_dict(board) if board else {}}

        actions = result.get("actions", [])
        board_updated = False
        for action in actions:
            action_type = action.get("type")
            params = action.get("params", {})

            if action_type == "create_card":
                col = _get_user_column(params["column_id"], user.id, db)
                if col:
                    max_pos = max((c.position for c in col.cards), default=-1)
                    db.add(Card(
                        column_id=params["column_id"],
                        title=params.get("title", "New Card"),
                        description=params.get("description", ""),
                        position=max_pos + 1,
                    ))
                    board_updated = True

            elif action_type == "edit_card":
                card = _get_user_card(params["card_id"], user.id, db)
                if card:
                    if "title" in params:
                        card.title = params["title"]
                    if "description" in params:
                        card.description = params["description"]
                    board_updated = True

            elif action_type == "move_card":
                card = _get_user_card(params["card_id"], user.id, db)
                if card:
                    target_col = _get_user_column(params["column_id"], user.id, db)
                    if not target_col:
                        continue  # skip this action silently
                    card.column_id = target_col.id
                    card.position = params.get("position", 0)
                    board_updated = True

            elif action_type == "delete_card":
                card = _get_user_card(params["card_id"], user.id, db)
                if card:
                    db.delete(card)
                    board_updated = True

            elif action_type == "rename_column":
                col = _get_user_column(params["column_id"], user.id, db)
                if col:
                    col.name = params["name"]
                    board_updated = True

        db.commit()
        db.expire_all()
        board = _get_user_board(user.id, db)

        return {
            "message": result.get("message", "Done"),
            "actions": actions,
            "board_updated": board_updated,
            "board": board_to_dict(board) if board else {},
        }

    except Exception:
        logger.exception("AI chat error")
        return {"message": "An error occurred. Please try again.", "actions": [], "board_updated": False}


# Include API router
app.include_router(router)

# Serve static frontend via middleware (does not interfere with API routes)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    from starlette.responses import Response as StarletteResponse

    @app.middleware("http")
    async def serve_static(request: Request, call_next):
        # Let API routes handle their own requests
        if request.url.path.startswith("/api"):
            return await call_next(request)

        # Only serve static for GET requests
        if request.method != "GET":
            return await call_next(request)

        path = request.url.path.lstrip("/")

        # Try exact file
        file_path = os.path.join(static_dir, path)

        # Prevent path traversal
        real_file = os.path.realpath(file_path)
        real_static = os.path.realpath(static_dir)
        if not real_file.startswith(real_static + os.sep) and real_file != real_static:
            return Response(status_code=404)

        if path and os.path.isfile(file_path):
            content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
            with open(file_path, "rb") as f:
                return StarletteResponse(f.read(), media_type=content_type)

        # Try path/index.html
        index_path = (
            os.path.join(static_dir, path, "index.html")
            if path
            else os.path.join(static_dir, "index.html")
        )
        if os.path.isfile(index_path):
            with open(index_path, "rb") as f:
                return StarletteResponse(f.read(), media_type="text/html")

        # Try path.html
        html_path = os.path.join(static_dir, path + ".html")
        if os.path.isfile(html_path):
            with open(html_path, "rb") as f:
                return StarletteResponse(f.read(), media_type="text/html")

        # SPA fallback - serve index.html
        root_index = os.path.join(static_dir, "index.html")
        if os.path.isfile(root_index):
            with open(root_index, "rb") as f:
                return StarletteResponse(f.read(), media_type="text/html")

        return await call_next(request)
