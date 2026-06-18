import os
import re
from urllib.parse import quote_plus
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "pmdb")

if not DB_USER or not DB_PASS:
    raise RuntimeError("DB_USER and DB_PASS environment variables must be set")
if not re.match(r'^[a-zA-Z0-9_]+$', DB_NAME):
    raise RuntimeError(f"DB_NAME contains invalid characters: {DB_NAME}")

DATABASE_URL = f"mysql+pymysql://{quote_plus(DB_USER)}:{quote_plus(DB_PASS)}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    boards = relationship("Board", back_populates="user", cascade="all, delete-orphan")


class Board(Base):
    __tablename__ = "boards"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    user = relationship("User", back_populates="boards")
    columns = relationship("BoardColumn", back_populates="board", order_by="BoardColumn.position", cascade="all, delete-orphan")


class BoardColumn(Base):
    __tablename__ = "columns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    board = relationship("Board", back_populates="columns")
    cards = relationship("Card", back_populates="column", order_by="Card.position", cascade="all, delete-orphan")


class Card(Base):
    __tablename__ = "cards"
    id = Column(Integer, primary_key=True, autoincrement=True)
    column_id = Column(Integer, ForeignKey("columns.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    priority = Column(String(20), default="medium")  # low, medium, high, critical
    card_type = Column(String(20), default="task")  # task, bug, issue, feature, improvement
    points = Column(Integer, default=0)
    position = Column(Integer, nullable=False, default=0)
    column = relationship("BoardColumn", back_populates="cards")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _hash_for_seed(password: str) -> str:
    """Local bcrypt hash for seeding — avoids circular import with auth.py."""
    from passlib.context import CryptContext
    _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return _ctx.hash(password)


def init_db():
    """Create tables and seed default data if empty."""
    import time
    import pymysql

    for attempt in range(15):
        try:
            conn = pymysql.connect(host=DB_HOST, port=int(DB_PORT), user=DB_USER, password=DB_PASS)
            with conn.cursor() as cur:
                cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}`")
            conn.close()
            break
        except pymysql.err.OperationalError:
            print(f"Waiting for MySQL... attempt {attempt + 1}/15")
            time.sleep(2)
    else:
        raise RuntimeError("Could not connect to MySQL after 15 attempts")

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            seed_user = User(username="admin", password_hash=_hash_for_seed("ChangeMe123!"))
            db.add(seed_user)
            db.flush()

            board = Board(user_id=seed_user.id, name="My Board")
            db.add(board)
            db.flush()

            for i, col_name in enumerate(["Backlog", "To Do", "In Progress", "Test", "Done"]):
                db.add(BoardColumn(board_id=board.id, name=col_name, position=i))

            db.commit()
    finally:
        db.close()
