import os
import json
import sqlite3
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid

# ── Try real MongoDB first ──────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "")
_USE_MONGO = False

if MONGODB_URI and "localhost" not in MONGODB_URI and "127.0.0.1" not in MONGODB_URI:
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from bson import ObjectId
        _client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        _db     = _client.nematron_chat
        chats_col    = _db.get_collection("chats")
        messages_col = _db.get_collection("messages")
        memories_col = _db.get_collection("memories")
        files_col    = _db.get_collection("files")
        users_col    = _db.get_collection("users")
        _USE_MONGO = True
        print("[DB] Using MongoDB Atlas connection.")
    except Exception as e:
        print(f"[DB] MongoDB unavailable ({e}), using persistent SQLite store.")
        _USE_MONGO = False
else:
    print("[DB] MONGODB_URI not provided or local, using persistent SQLite store.")

# ── SQLite Persistent Fallback ─────────────────────────────────────────────
_default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nematron.db")
try:
    _chk_file = _default_db + ".chk"
    with open(_chk_file, "w") as _f:
        _f.write("1")
    if os.path.exists(_chk_file):
        os.remove(_chk_file)
    DB_PATH = _default_db
except Exception:
    DB_PATH = os.path.join(os.getenv("TEMP", os.getenv("TMP", "/tmp")), "nematron.db")

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _init_sqlite():
    if _USE_MONGO:
        return
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                name TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                user_id TEXT DEFAULT '',
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        # Migration: add user_id if missing from existing DB
        try:
            cursor.execute("ALTER TABLE chats ADD COLUMN user_id TEXT DEFAULT ''")
        except Exception:
            pass
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                file_ids TEXT DEFAULT '[]',
                timestamp TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                context TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                extracted_text TEXT DEFAULT '',
                uploaded_at TEXT NOT NULL
            )
        """)
        # Indexes after tables exist
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        conn.commit()

_init_sqlite()

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _new_id() -> str:
    return str(uuid.uuid4())

# ── Helper: format ObjectId for real Mongo docs ──────────────────────────────
def _fmt(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "chat_id" in doc:
        try:
            from bson import ObjectId
            if isinstance(doc["chat_id"], ObjectId):
                doc["chat_id"] = str(doc["chat_id"])
        except Exception:
            pass
    return doc

# ════════════════════════════════════════════════════════════════════════════
#  CHATS
# ════════════════════════════════════════════════════════════════════════════
async def create_chat(user_id: str, title: str = "New Chat") -> Dict[str, Any]:
    if _USE_MONGO:
        from bson import ObjectId
        doc = {"user_id": user_id, "title": title, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
        res = await chats_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return _fmt(doc)

    cid = _new_id()
    now_str = _now()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO chats (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (cid, user_id, title, now_str, now_str)
        )
        conn.commit()
    return {"_id": cid, "user_id": user_id, "title": title, "created_at": now_str, "updated_at": now_str}

async def get_chats(user_id: str) -> List[Dict[str, Any]]:
    if _USE_MONGO:
        cur = chats_col.find({"user_id": user_id}).sort("updated_at", -1)
        return [_fmt(c) for c in await cur.to_list(length=200)]

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
        rows = cursor.fetchall()
        return [
            {
                "_id": row["id"],
                "user_id": row["user_id"],
                "title": row["title"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            }
            for row in rows
        ]

async def get_chat(chat_id: str) -> Optional[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = await chats_col.find_one({"_id": ObjectId(chat_id)})
            return _fmt(doc)
        except Exception:
            return None

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chats WHERE id = ?", (chat_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "_id": row["id"],
            "user_id": row["user_id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }

async def update_chat_title(chat_id: str, title: str) -> bool:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            res = await chats_col.update_one(
                {"_id": ObjectId(chat_id)},
                {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}}
            )
            return res.modified_count > 0
        except Exception:
            return False

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE chats SET title = ?, updated_at = ? WHERE id = ?",
            (title, _now(), chat_id)
        )
        conn.commit()
        return cursor.rowcount > 0

async def delete_chat(chat_id: str) -> bool:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            await messages_col.delete_many({"chat_id": ObjectId(chat_id)})
            res = await chats_col.delete_one({"_id": ObjectId(chat_id)})
            return res.deleted_count > 0
        except Exception:
            return False

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
        cursor.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        conn.commit()
        return cursor.rowcount > 0

# ════════════════════════════════════════════════════════════════════════════
#  MESSAGES
# ════════════════════════════════════════════════════════════════════════════
async def add_message(chat_id: str, role: str, content: str, file_ids: List[str] = None) -> Dict[str, Any]:
    file_ids = file_ids or []
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = {
                "chat_id": ObjectId(chat_id), "role": role, "content": content,
                "file_ids": file_ids, "timestamp": datetime.now(timezone.utc)
            }
            res = await messages_col.insert_one(doc)
            doc["_id"] = res.inserted_id
            await chats_col.update_one(
                {"_id": ObjectId(chat_id)},
                {"$set": {"updated_at": datetime.now(timezone.utc)}}
            )
            return _fmt(doc)
        except Exception:
            pass

    mid = _new_id()
    now_str = _now()
    file_ids_json = json.dumps(file_ids)
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (id, chat_id, role, content, file_ids, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (mid, chat_id, role, content, file_ids_json, now_str)
        )
        cursor.execute(
            "UPDATE chats SET updated_at = ? WHERE id = ?",
            (now_str, chat_id)
        )
        conn.commit()
    return {"_id": mid, "chat_id": chat_id, "role": role, "content": content, "file_ids": file_ids, "timestamp": now_str}

async def get_messages(chat_id: str) -> List[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            cur = messages_col.find({"chat_id": ObjectId(chat_id)}).sort("timestamp", 1)
            return [_fmt(m) for m in await cur.to_list(length=2000)]
        except Exception:
            return []

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC", (chat_id,))
        rows = cursor.fetchall()
        messages = []
        for r in rows:
            try:
                fids = json.loads(r["file_ids"])
            except Exception:
                fids = []
            messages.append({
                "_id": r["id"],
                "chat_id": r["chat_id"],
                "role": r["role"],
                "content": r["content"],
                "file_ids": fids,
                "timestamp": r["timestamp"]
            })
        return messages

# ════════════════════════════════════════════════════════════════════════════
#  MEMORIES
# ════════════════════════════════════════════════════════════════════════════
async def add_memory(content: str, context: str) -> Dict[str, Any]:
    if _USE_MONGO:
        try:
            doc = {"content": content, "context": context, "timestamp": datetime.now(timezone.utc)}
            res = await memories_col.insert_one(doc)
            doc["_id"] = res.inserted_id
            return _fmt(doc)
        except Exception:
            pass

    mid = _new_id()
    now_str = _now()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO memories (id, content, context, timestamp) VALUES (?, ?, ?, ?)",
            (mid, content, context, now_str)
        )
        conn.commit()
    return {"_id": mid, "content": content, "context": context, "timestamp": now_str}

async def get_all_memories() -> List[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            cur = memories_col.find().sort("timestamp", -1)
            return [_fmt(m) for m in await cur.to_list(length=200)]
        except Exception:
            return []

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM memories ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        return [
            {
                "_id": row["id"],
                "content": row["content"],
                "context": row["context"],
                "timestamp": row["timestamp"]
            }
            for row in rows
        ]

# ════════════════════════════════════════════════════════════════════════════
#  FILES
# ════════════════════════════════════════════════════════════════════════════
async def add_file_record(filename: str, content_type: str, extracted_text: str = "") -> Dict[str, Any]:
    if _USE_MONGO:
        try:
            doc = {"filename": filename, "content_type": content_type,
                   "extracted_text": extracted_text, "uploaded_at": datetime.now(timezone.utc)}
            res = await files_col.insert_one(doc)
            doc["_id"] = res.inserted_id
            return _fmt(doc)
        except Exception:
            pass

    fid = _new_id()
    now_str = _now()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO files (id, filename, content_type, extracted_text, uploaded_at) VALUES (?, ?, ?, ?, ?)",
            (fid, filename, content_type, extracted_text, now_str)
        )
        conn.commit()
    return {"_id": fid, "filename": filename, "content_type": content_type, "extracted_text": extracted_text, "uploaded_at": now_str}

async def get_file_record(file_id: str) -> Optional[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = await files_col.find_one({"_id": ObjectId(file_id)})
            return _fmt(doc)
        except Exception:
            return None

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "_id": row["id"],
            "filename": row["filename"],
            "content_type": row["content_type"],
            "extracted_text": row["extracted_text"],
            "uploaded_at": row["uploaded_at"]
        }

# ════════════════════════════════════════════════════════════════════════════
#  USERS
# ════════════════════════════════════════════════════════════════════════════
async def create_user(email: str, hashed_password: str, name: str = "") -> Dict[str, Any]:
    clean_email = email.lower().strip()
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = {
                "email": clean_email,
                "hashed_password": hashed_password,
                "name": name,
                "created_at": datetime.now(timezone.utc)
            }
            res = await users_col.insert_one(doc)
            doc["_id"] = res.inserted_id
            return _fmt(doc)
        except Exception as e:
            raise e

    uid = _new_id()
    created_at = _now()
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (id, email, hashed_password, name, created_at) VALUES (?, ?, ?, ?, ?)",
            (uid, clean_email, hashed_password, name, created_at)
        )
        conn.commit()
    return {
        "_id": uid,
        "email": clean_email,
        "hashed_password": hashed_password,
        "name": name,
        "created_at": created_at
    }

async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    clean_email = email.lower().strip()
    if _USE_MONGO:
        try:
            doc = await users_col.find_one({"email": clean_email})
            return _fmt(doc) if doc else None
        except Exception:
            return None

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE lower(email) = ?", (clean_email,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "_id": row["id"],
            "email": row["email"],
            "hashed_password": row["hashed_password"],
            "name": row["name"],
            "created_at": row["created_at"]
        }

async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = await users_col.find_one({"_id": ObjectId(user_id)})
            return _fmt(doc) if doc else None
        except Exception:
            return None

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "_id": row["id"],
            "email": row["email"],
            "hashed_password": row["hashed_password"],
            "name": row["name"],
            "created_at": row["created_at"]
        }

async def get_all_users() -> List[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            cur = users_col.find().sort("created_at", -1)
            return [_fmt(u) for u in await cur.to_list(length=1000)]
        except Exception:
            return []

    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [
            {
                "_id": row["id"],
                "email": row["email"],
                "name": row["name"],
                "created_at": row["created_at"]
            }
            for row in rows
        ]


