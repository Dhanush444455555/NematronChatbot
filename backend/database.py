import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid

# ── Try real MongoDB first, fall back to in-memory ──────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "")
_USE_MONGO = bool(MONGODB_URI and "localhost" not in MONGODB_URI and "127.0.0.1" not in MONGODB_URI)

if _USE_MONGO:
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from bson import ObjectId
        _client = AsyncIOMotorClient(MONGODB_URI)
        _db     = _client.nematron_chat
        chats_col    = _db.get_collection("chats")
        messages_col = _db.get_collection("messages")
        memories_col = _db.get_collection("memories")
        files_col    = _db.get_collection("files")
    except Exception as e:
        print(f"[DB] MongoDB unavailable ({e}), using in-memory store.")
        _USE_MONGO = False

# ── In-memory fallback stores ────────────────────────────────────────────────
_chats:    Dict[str, Dict] = {}   # id -> chat doc
_messages: Dict[str, List] = {}   # chat_id -> [msg, ...]
_memories: List[Dict]      = []
_files:    Dict[str, Dict] = {}   # id -> file doc

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
async def create_chat(title: str = "New Chat") -> Dict[str, Any]:
    if _USE_MONGO:
        from bson import ObjectId
        doc = {"title": title, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
        res = await chats_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return _fmt(doc)
    # in-memory
    cid = _new_id()
    doc = {"_id": cid, "title": title, "created_at": _now(), "updated_at": _now()}
    _chats[cid] = doc
    _messages[cid] = []
    return dict(doc)

async def get_chats() -> List[Dict[str, Any]]:
    if _USE_MONGO:
        cur = chats_col.find().sort("updated_at", -1)
        return [_fmt(c) for c in await cur.to_list(length=200)]
    return sorted(_chats.values(), key=lambda c: c.get("updated_at", ""), reverse=True)

async def get_chat(chat_id: str) -> Optional[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = await chats_col.find_one({"_id": ObjectId(chat_id)})
            return _fmt(doc)
        except Exception:
            return None
    return dict(_chats[chat_id]) if chat_id in _chats else None

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
    if chat_id in _chats:
        _chats[chat_id]["title"] = title
        _chats[chat_id]["updated_at"] = _now()
        return True
    return False

async def delete_chat(chat_id: str) -> bool:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            await messages_col.delete_many({"chat_id": ObjectId(chat_id)})
            res = await chats_col.delete_one({"_id": ObjectId(chat_id)})
            return res.deleted_count > 0
        except Exception:
            return False
    existed = chat_id in _chats
    _chats.pop(chat_id, None)
    _messages.pop(chat_id, None)
    return existed

# ════════════════════════════════════════════════════════════════════════════
#  MESSAGES
# ════════════════════════════════════════════════════════════════════════════
async def add_message(chat_id: str, role: str, content: str, file_ids: List[str] = None) -> Dict[str, Any]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = {
                "chat_id": ObjectId(chat_id), "role": role, "content": content,
                "file_ids": file_ids or [], "timestamp": datetime.now(timezone.utc)
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
    # in-memory
    mid = _new_id()
    doc = {"_id": mid, "chat_id": chat_id, "role": role, "content": content,
           "file_ids": file_ids or [], "timestamp": _now()}
    _messages.setdefault(chat_id, []).append(doc)
    if chat_id in _chats:
        _chats[chat_id]["updated_at"] = _now()
    return dict(doc)

async def get_messages(chat_id: str) -> List[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            cur = messages_col.find({"chat_id": ObjectId(chat_id)}).sort("timestamp", 1)
            return [_fmt(m) for m in await cur.to_list(length=2000)]
        except Exception:
            return []
    return [dict(m) for m in _messages.get(chat_id, [])]

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
    doc = {"_id": mid, "content": content, "context": context, "timestamp": _now()}
    _memories.append(doc)
    return dict(doc)

async def get_all_memories() -> List[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            cur = memories_col.find().sort("timestamp", -1)
            return [_fmt(m) for m in await cur.to_list(length=200)]
        except Exception:
            return []
    return list(reversed(_memories))

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
    doc = {"_id": fid, "filename": filename, "content_type": content_type,
           "extracted_text": extracted_text, "uploaded_at": _now()}
    _files[fid] = doc
    return dict(doc)

async def get_file_record(file_id: str) -> Optional[Dict[str, Any]]:
    if _USE_MONGO:
        try:
            from bson import ObjectId
            doc = await files_col.find_one({"_id": ObjectId(file_id)})
            return _fmt(doc)
        except Exception:
            return None
    return dict(_files[file_id]) if file_id in _files else None
