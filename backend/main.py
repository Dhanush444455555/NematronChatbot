import os
import json
import asyncio
import hashlib
import hmac
import secrets
import base64
import requests as http_requests
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from openai import AsyncOpenAI
from dotenv import load_dotenv
import jwt as pyjwt

import database as db
from extractors import process_file_upload
from agents import determine_agent_and_prompt

# Load .env from the same directory as this file (works on both local and Vercel)
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path, override=False)

app = FastAPI(
    title="NVIDIA Nemotron AI Backend",
    description="Python FastAPI backend using NVIDIA NIM API with Nemotron thinking model",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "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")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "nvidia/llama-3.1-nemotron-70b-instruct")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nvidia/nv-embedqa-e5-v5")
# MiniMax M3 uses a separate API key on the same NVIDIA NIM base URL
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "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")

# ── Auth Config (stdlib only — no native compilation needed) ─────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "nematron-super-secret-jwt-key-change-in-prod-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 365
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "1si24ci013@sit.ac.in").lower().strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Dhanu@555")

security = HTTPBearer(auto_error=False)

# Reduced to 100k iterations — still secure, but won't time-out on serverless cold starts
_PBKDF2_ITERS = 100_000

def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 — stdlib, secure, no native deps."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ITERS)
    return salt + ":" + base64.b64encode(dk).decode()

def verify_password(plain: str, stored: str) -> bool:
    """Verify password — handles both 100k and legacy 260k iteration hashes."""
    try:
        salt, b64_dk = stored.split(":", 1)
        dk_stored = base64.b64decode(b64_dk)
        # Try current iteration count first
        dk_check = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _PBKDF2_ITERS)
        if hmac.compare_digest(dk_stored, dk_check):
            return True
        # Fallback: try old 260k iteration count (legacy hashes)
        dk_check_legacy = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260000)
        return hmac.compare_digest(dk_stored, dk_check_legacy)
    except Exception:
        return False

def create_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return pyjwt.encode({"sub": user_id, "email": email, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

MODEL_API_KEY_MAP: dict = {
    "minimaxai/minimax-m3": MINIMAX_API_KEY,
}

def resolve_api_key(model: str, request_key: str) -> str:
    """Return the correct API key for a given model."""
    if request_key:
        return request_key
    return MODEL_API_KEY_MAP.get(model, NVIDIA_API_KEY)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    messages: List[ChatMessage]
    file_ids: Optional[List[str]] = []
    model: Optional[str] = DEFAULT_MODEL
    system_prompt: Optional[str] = None
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = 0.95
    enable_thinking: Optional[bool] = True
    reasoning_budget: Optional[int] = 32768
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class ChatRenameRequest(BaseModel):
    title: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""

class LoginRequest(BaseModel):
    email: str
    password: str

AVAILABLE_MODELS = [
    {
        "id": "nvidia/nemotron-3-ultra-550b-a55b",
        "name": "Nemotron 3 Ultra 550B",
        "description": "NVIDIA's most powerful thinking model with deep chain-of-thought reasoning.",
        "badge": "Thinking 🧠"
    },
    {
        "id": "minimaxai/minimax-m3",
        "name": "MiniMax M3",
        "description": "MiniMax M3 — powerful multi-modal large language model via NVIDIA NIM.",
        "badge": "Multi-modal 🌟"
    },
    {
        "id": "nvidia/llama-3.1-nemotron-70b-instruct",
        "name": "Llama 3.1 Nemotron 70B",
        "description": "Fast and capable instruction-following model fine-tuned by NVIDIA.",
        "badge": "Fast ⚡"
    },
    {
        "id": "nvidia/mistral-nemo-12b-instruct",
        "name": "Mistral Nemo 12B",
        "description": "Compact and efficient multilingual model for quick tasks.",
        "badge": "Compact 🔹"
    }
]

@app.get("/")
def read_root():
    return {"status": "online", "message": "NVIDIA Nemotron Backend is running."}

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is healthy."}

@app.get("/api/models")
def get_models():
    return {"models": AVAILABLE_MODELS}

# --- AUTH API ---
@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    email = request.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    if not request.password or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = await db.get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = hash_password(request.password)
    user = await db.create_user(email, hashed, request.name or "")
    token = create_token(user["_id"], email)

    is_admin = (email == ADMIN_EMAIL)
    return {
        "token": token,
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "is_admin": is_admin
        }
    }

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    email = request.email.lower().strip()
    user = await db.get_user_by_email(email)

    # Special handling for Admin email auto-creation / login
    if email == ADMIN_EMAIL:
        if not user:
            # Auto-create admin user in DB
            hashed = hash_password(ADMIN_PASSWORD)
            user = await db.create_user(ADMIN_EMAIL, hashed, "Admin (Dhanush)")
        
        # Verify password matches either custom password or configured ADMIN_PASSWORD
        if not verify_password(request.password, user["hashed_password"]) and request.password != ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_token(user["_id"], email)
        return {
            "token": token,
            "user": {
                "id": user["_id"],
                "email": user["email"],
                "name": user.get("name", "Admin (Dhanush)"),
                "is_admin": True
            }
        }

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user["_id"], email)
    return {
        "token": token,
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "is_admin": False
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    email = current_user["email"].lower()
    return {
        "user": {
            "id": current_user["_id"],
            "email": current_user["email"],
            "name": current_user.get("name", ""),
            "is_admin": (email == ADMIN_EMAIL)
        }
    }

@app.get("/api/admin/users")
async def get_admin_users(current_user: dict = Depends(get_current_user)):
    email = current_user["email"].lower()
    if email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required.")

    users = await db.get_all_users()
    user_list = []
    for u in users:
        user_list.append({
            "id": str(u.get("_id", "")),
            "email": u.get("email", ""),
            "name": u.get("name", ""),
            "created_at": str(u.get("created_at", ""))
        })
    return {"users": user_list, "total": len(user_list)}

# --- CHAT MANAGEMENT API (user-scoped — each user sees only their own chats) ---
@app.get("/api/chats")
async def get_chats(current_user: dict = Depends(get_current_user)):
    chats = await db.get_chats(user_id=current_user["_id"])
    return {"chats": chats}

@app.get("/api/chats/{chat_id}")
async def get_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    chat = await db.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    # Only owner or admin can read
    if chat.get("user_id") and chat["user_id"] != current_user["_id"] and current_user["email"].lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Access denied")
    messages = await db.get_messages(chat_id)
    return {"chat": chat, "messages": messages}

@app.put("/api/chats/{chat_id}")
async def rename_chat(chat_id: str, request: ChatRenameRequest, current_user: dict = Depends(get_current_user)):
    chat = await db.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.get("user_id") and chat["user_id"] != current_user["_id"] and current_user["email"].lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Access denied")
    success = await db.update_chat_title(chat_id, request.title)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found or could not be updated")
    return {"success": True}

@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    chat = await db.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.get("user_id") and chat["user_id"] != current_user["_id"] and current_user["email"].lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Access denied")
    success = await db.delete_chat(chat_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found or could not be deleted")
    return {"success": True}

# --- UPLOAD API ---
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        extracted_text = process_file_upload(file.filename, file.content_type, contents)
        file_record = await db.add_file_record(file.filename, file.content_type, extracted_text)
        return {"success": True, "file_id": str(file_record["_id"]), "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Models that must use the plain requests fallback (no SSE streaming support)
NON_STREAMING_MODELS = {"minimaxai/minimax-m3"}

# --- CORE CHAT API ---
async def generate_stream(request_data: ChatRequest, chat_id: str):
    model = request_data.model or DEFAULT_MODEL
    api_key = resolve_api_key(model, request_data.api_key or "")
    base_url = request_data.base_url or NVIDIA_BASE_URL

    # ── MiniMax M3 (and similar) – plain HTTP, no streaming ──────────────────
    if model in NON_STREAMING_MODELS:
        async for event in _generate_non_stream(request_data, chat_id, model, api_key, base_url):
            yield event
        return

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    # Gather file data and memories
    files_data = []
    if request_data.file_ids:
        for fid in request_data.file_ids:
            f = await db.get_file_record(fid)
            if f:
                files_data.append(f)
                
    memories = await db.get_all_memories()

    # Get the last user message
    user_msg_content = request_data.messages[-1].content if request_data.messages else ""

    # Build Augmented System Prompt using Agents
    augmented_system_prompt = determine_agent_and_prompt(user_msg_content, files_data, memories)

    messages = [{"role": "system", "content": augmented_system_prompt}]
    for m in request_data.messages:
        messages.append({"role": m.role, "content": m.content})

    extra_body = {}
    if request_data.enable_thinking:
        extra_body = {
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": request_data.reasoning_budget or 16384
        }

    try:
        import asyncio as _asyncio
        completion = await _asyncio.wait_for(
            client.chat.completions.create(
                model=request_data.model or DEFAULT_MODEL,
                messages=messages,
                temperature=request_data.temperature if request_data.temperature is not None else 0.7,
                top_p=request_data.top_p if request_data.top_p is not None else 0.95,
                extra_body=extra_body if extra_body else None,
                stream=True,
                max_tokens=2048
            ),
            timeout=55
        )

        in_thinking = False
        full_assistant_content = ""
        full_thinking_content = ""
        
        # We need to yield chat_id first so frontend knows
        yield f"data: {json.dumps({'chat_id': chat_id})}\n\n"

        async for chunk in completion:
            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta
            reasoning = getattr(delta, "reasoning_content", None)
            
            if reasoning:
                full_thinking_content += reasoning
                if not in_thinking:
                    yield f"data: {json.dumps({'thinking_start': True})}\n\n"
                    in_thinking = True
                yield f"data: {json.dumps({'thinking': reasoning})}\n\n"

            if delta.content is not None:
                full_assistant_content += delta.content
                if in_thinking:
                    yield f"data: {json.dumps({'thinking_end': True})}\n\n"
                    in_thinking = False
                yield f"data: {json.dumps({'delta': delta.content})}\n\n"

        yield "data: [DONE]\n\n"

        # Save assistant message
        final_content = full_assistant_content
        if full_thinking_content:
            final_content = f"<thought>\n{full_thinking_content}\n</thought>\n{full_assistant_content}"
            
        await db.add_message(chat_id, "assistant", final_content)

    except Exception as e:
        err_str = str(e)
        if "timeout" in err_str.lower() or "TimeoutError" in err_str:
            yield f"data: {json.dumps({'error': 'Request timed out. Please try again with a shorter message.'})}\n\n"
        elif "401" in err_str or "Unauthorized" in err_str:
            yield f"data: {json.dumps({'error': 'Invalid API key. Please check your NVIDIA API key in Settings.'})}\n\n"
        elif "Connection" in err_str or "connect" in err_str.lower():
            yield f"data: {json.dumps({'error': 'Connection error. Please try again in a moment.'})}\n\n"
        else:
            yield f"data: {json.dumps({'error': f'API Error: {err_str[:200]}'})}\n\n"


async def _generate_non_stream(
    request_data: ChatRequest,
    chat_id: str,
    model: str,
    api_key: str,
    base_url: str,
):
    """Fallback for models that don't support SSE streaming (e.g. MiniMax M3).
    Uses a plain HTTP POST via `requests` and yields the full response at once.
    """
    # Gather file data and memories (same as main stream path)
    files_data = []
    if request_data.file_ids:
        for fid in request_data.file_ids:
            f = await db.get_file_record(fid)
            if f:
                files_data.append(f)

    memories = await db.get_all_memories()
    user_msg_content = request_data.messages[-1].content if request_data.messages else ""
    augmented_system_prompt = determine_agent_and_prompt(user_msg_content, files_data, memories)

    messages = [{"role": "system", "content": augmented_system_prompt}]
    for m in request_data.messages:
        messages.append({"role": m.role, "content": m.content})

    invoke_url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": request_data.temperature if request_data.temperature is not None else 1.0,
        "top_p": request_data.top_p if request_data.top_p is not None else 0.95,
        "stream": False,
    }

    try:
        # Run the blocking requests call in a thread so we don't block the event loop
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(
            None,
            lambda: http_requests.post(invoke_url, headers=headers, json=payload, timeout=120),
        )
        resp.raise_for_status()
        data = resp.json()

        assistant_content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        # Yield chat_id first so the frontend knows which chat this belongs to
        yield f"data: {json.dumps({'chat_id': chat_id})}\n\n"
        # Yield the full content as a single delta so existing frontend SSE logic works
        yield f"data: {json.dumps({'delta': assistant_content})}\n\n"
        yield "data: [DONE]\n\n"

        await db.add_message(chat_id, "assistant", assistant_content)

    except Exception as e:
        yield f"data: {json.dumps({'error': f'MiniMax API Error: {str(e)}'})}\n\n"

@app.post("/api/chat")
async def chat_endpoint(request_data: ChatRequest, current_user: dict = Depends(get_current_user)):
    if not NVIDIA_API_KEY and not request_data.api_key:
        raise HTTPException(status_code=400, detail="API key is required.")

    user_id = current_user["_id"]
    chat_id = request_data.chat_id
    if not chat_id:
        chat_title = "New Chat"
        if request_data.messages:
            chat_title = request_data.messages[0].content[:40] + "..."
        new_chat = await db.create_chat(user_id=user_id, title=chat_title)
        chat_id = new_chat["_id"]
    else:
        # Verify the chat belongs to this user
        existing = await db.get_chat(chat_id)
        if existing and existing.get("user_id") and existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

    if request_data.messages:
        last_msg = request_data.messages[-1]
        await db.add_message(chat_id, last_msg.role, last_msg.content, request_data.file_ids)

    return StreamingResponse(
        generate_stream(request_data, chat_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
