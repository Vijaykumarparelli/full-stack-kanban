import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from database import Board, BoardColumn, Card, User, get_db, init_db
from auth import create_token, get_current_user, hash_password


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


@api.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or user.password_hash != hash_password(req.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"token": create_token(user.id)}


@api.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username}


def card_to_dict(card: Card) -> dict:
    return {
        "id": card.id,
        "column_id": card.column_id,
        "title": card.title,
        "description": card.description or "",
        "priority": card.priority or "medium",
        "card_type": card.card_type or "task",
        "points": card.points or 0,
        "position": card.position,
    }


# --- Board ---

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


@api.get("/board")
def get_board(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.user_id == user.id).first()
    if not board:
        raise HTTPException(status_code=404, detail="No board found")
    return board_to_dict(board)


# --- Columns ---

class RenameColumnRequest(BaseModel):
    name: str


@api.put("/columns/{column_id}")
def rename_column(
    column_id: int,
    req: RenameColumnRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = db.query(BoardColumn).join(Board).filter(BoardColumn.id == column_id, Board.user_id == user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    col.name = req.name
    db.commit()
    db.refresh(col)
    return {"id": col.id, "board_id": col.board_id, "name": col.name, "position": col.position}


# --- Cards ---

class CreateCardRequest(BaseModel):
    column_id: int
    title: str
    description: str = ""
    priority: str = "medium"
    card_type: str = "task"
    points: int = 0


class UpdateCardRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    card_type: str | None = None
    points: int | None = None


class MoveCardRequest(BaseModel):
    column_id: int
    position: int


@api.post("/cards", status_code=201)
def create_card(
    req: CreateCardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = db.query(BoardColumn).join(Board).filter(BoardColumn.id == req.column_id, Board.user_id == user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    max_pos = max((c.position for c in col.cards), default=-1)
    card = Card(column_id=req.column_id, title=req.title, description=req.description,
                priority=req.priority, card_type=req.card_type, points=req.points, position=max_pos + 1)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card_to_dict(card)


@api.put("/cards/{card_id}")
def update_card(
    card_id: int,
    req: UpdateCardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(Card).join(BoardColumn).join(Board).filter(Card.id == card_id, Board.user_id == user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if req.title is not None:
        card.title = req.title
    if req.description is not None:
        card.description = req.description
    if req.priority is not None:
        card.priority = req.priority
    if req.card_type is not None:
        card.card_type = req.card_type
    if req.points is not None:
        card.points = req.points
    db.commit()
    db.refresh(card)
    return card_to_dict(card)


@api.put("/cards/{card_id}/move")
def move_card(
    card_id: int,
    req: MoveCardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(Card).join(BoardColumn).join(Board).filter(Card.id == card_id, Board.user_id == user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    target_col = db.query(BoardColumn).join(Board).filter(BoardColumn.id == req.column_id, Board.user_id == user.id).first()
    if not target_col:
        raise HTTPException(status_code=404, detail="Target column not found")

    card.column_id = req.column_id
    card.position = req.position

    siblings = db.query(Card).filter(Card.column_id == req.column_id, Card.id != card.id).order_by(Card.position).all()
    for i, sibling in enumerate(siblings):
        new_pos = i if i < req.position else i + 1
        sibling.position = new_pos
    card.position = req.position

    db.commit()
    db.refresh(card)
    return card_to_dict(card)


@api.get("/cards")
def get_all_cards(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all cards for the user's board (for backlog view)."""
    board = db.query(Board).filter(Board.user_id == user.id).first()
    if not board:
        return []
    cards = (
        db.query(Card)
        .join(BoardColumn)
        .filter(BoardColumn.board_id == board.id)
        .order_by(Card.position)
        .all()
    )
    # Include column name for display
    result = []
    for card in cards:
        d = card_to_dict(card)
        d["column_name"] = card.column.name
        result.append(d)
    return result


@api.delete("/cards/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(Card).join(BoardColumn).join(Board).filter(Card.id == card_id, Board.user_id == user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()


# --- AI Chat ---

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@api.post("/ai/chat")
def ai_chat(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from openai import OpenAI
    import json

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)

    board = db.query(Board).filter(Board.user_id == user.id).first()
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
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": req.message})

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b:free",
            messages=messages,
        )
        content = response.choices[0].message.content.strip()

        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            return {"message": content, "actions": [], "board": board_to_dict(board) if board else {}}

        actions = result.get("actions", [])
        for action in actions:
            action_type = action.get("type")
            params = action.get("params", {})

            if action_type == "create_card":
                col = db.query(BoardColumn).join(Board).filter(
                    BoardColumn.id == params["column_id"], Board.user_id == user.id
                ).first()
                if col:
                    max_pos = max((c.position for c in col.cards), default=-1)
                    db.add(Card(
                        column_id=params["column_id"],
                        title=params.get("title", "New Card"),
                        description=params.get("description", ""),
                        position=max_pos + 1,
                    ))

            elif action_type == "edit_card":
                card = db.query(Card).join(BoardColumn).join(Board).filter(
                    Card.id == params["card_id"], Board.user_id == user.id
                ).first()
                if card:
                    if "title" in params:
                        card.title = params["title"]
                    if "description" in params:
                        card.description = params["description"]

            elif action_type == "move_card":
                card = db.query(Card).join(BoardColumn).join(Board).filter(
                    Card.id == params["card_id"], Board.user_id == user.id
                ).first()
                if card:
                    card.column_id = params["column_id"]
                    card.position = params.get("position", 0)

            elif action_type == "delete_card":
                card = db.query(Card).join(BoardColumn).join(Board).filter(
                    Card.id == params["card_id"], Board.user_id == user.id
                ).first()
                if card:
                    db.delete(card)

            elif action_type == "rename_column":
                col = db.query(BoardColumn).join(Board).filter(
                    BoardColumn.id == params["column_id"], Board.user_id == user.id
                ).first()
                if col:
                    col.name = params["name"]

        db.commit()
        db.expire_all()
        board = db.query(Board).filter(Board.user_id == user.id).first()

        return {
            "message": result.get("message", "Done"),
            "actions": actions,
            "board": board_to_dict(board) if board else {},
        }

    except Exception as e:
        return {"message": f"AI error: {str(e)}", "actions": [], "board": board_to_dict(board) if board else {}}


# --- Health ---

@api.get("/health")
def health():
    return {"status": "ok"}


# Include API router
app.include_router(api)

# Serve static frontend via middleware (does not interfere with API routes)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    from starlette.middleware import Middleware
    from starlette.responses import Response as StarletteResponse
    import mimetypes

    @app.middleware("http")
    async def serve_static(request, call_next):
        # Let API routes handle their own requests
        if request.url.path.startswith("/api"):
            return await call_next(request)

        # Only serve static for GET requests
        if request.method != "GET":
            return await call_next(request)

        path = request.url.path.lstrip("/")

        # Try exact file
        file_path = os.path.join(static_dir, path)
        if path and os.path.isfile(file_path):
            content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
            with open(file_path, "rb") as f:
                return StarletteResponse(f.read(), media_type=content_type)

        # Try path/index.html
        index_path = os.path.join(static_dir, path, "index.html") if path else os.path.join(static_dir, "index.html")
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
