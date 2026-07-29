import os
import json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="NVIDIA Nemotron AI Backend",
    description="Python FastAPI backend using NVIDIA NIM API with Nemotron thinking model",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NVIDIA NIM configuration
NVIDIA_API_KEY = os.getenv(
    "NVIDIA_API_KEY",
    "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"
)
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "nvidia/nemotron-3-ultra-550b-a55b")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = DEFAULT_MODEL
    system_prompt: Optional[str] = "You are a helpful, harmless, and intelligent AI assistant."
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = 16384
    top_p: Optional[float] = 0.95
    enable_thinking: Optional[bool] = True
    reasoning_budget: Optional[int] = 16384
    api_key: Optional[str] = None
    base_url: Optional[str] = None


AVAILABLE_MODELS = [
    {
        "id": "nvidia/nemotron-3-ultra-550b-a55b",
        "name": "Nemotron 3 Ultra 550B",
        "description": "NVIDIA's most powerful thinking model with deep chain-of-thought reasoning.",
        "badge": "Thinking 🧠"
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
        "badge": "Compact"
    }
]


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "NVIDIA Nemotron FastAPI Backend is running.",
        "docs": "/docs",
        "default_model": DEFAULT_MODEL
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "has_api_key": bool(NVIDIA_API_KEY),
        "base_url": NVIDIA_BASE_URL,
        "default_model": DEFAULT_MODEL
    }


@app.get("/api/models")
def get_models():
    return {"models": AVAILABLE_MODELS}


def generate_stream(request_data: ChatRequest):
    """
    Generator that streams from NVIDIA NIM API using OpenAI client.
    Handles both reasoning_content (thinking tokens) and regular content.
    """
    api_key = request_data.api_key or NVIDIA_API_KEY
    base_url = request_data.base_url or NVIDIA_BASE_URL

    client = OpenAI(api_key=api_key, base_url=base_url)

    # Build messages list with optional system prompt
    messages = []
    if request_data.system_prompt:
        messages.append({"role": "system", "content": request_data.system_prompt})
    for m in request_data.messages:
        messages.append({"role": m.role, "content": m.content})

    # Extra body for NVIDIA thinking models
    extra_body = {}
    if request_data.enable_thinking:
        extra_body = {
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": request_data.reasoning_budget or 16384
        }

    try:
        completion = client.chat.completions.create(
            model=request_data.model or DEFAULT_MODEL,
            messages=messages,
            temperature=request_data.temperature if request_data.temperature is not None else 1.0,
            top_p=request_data.top_p if request_data.top_p is not None else 0.95,
            max_tokens=request_data.max_tokens or 16384,
            extra_body=extra_body if extra_body else None,
            stream=True
        )

        in_thinking = False
        
        for chunk in completion:
            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta

            # Handle NVIDIA reasoning/thinking tokens
            reasoning = getattr(delta, "reasoning_content", None)
            if reasoning:
                if not in_thinking:
                    # Signal start of thinking block
                    yield f"data: {json.dumps({'thinking_start': True})}\n\n"
                    in_thinking = True
                yield f"data: {json.dumps({'thinking': reasoning})}\n\n"

            # Handle regular content tokens
            if delta.content is not None:
                if in_thinking:
                    # Signal end of thinking block when regular content starts
                    yield f"data: {json.dumps({'thinking_end': True})}\n\n"
                    in_thinking = False
                yield f"data: {json.dumps({'delta': delta.content})}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': f'NVIDIA API Error: {str(e)}'})}\n\n"


@app.post("/api/chat")
async def chat_endpoint(request_data: ChatRequest):
    api_key = request_data.api_key or NVIDIA_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="NVIDIA API key is required. Set it in backend .env or frontend settings."
        )

    return StreamingResponse(
        generate_stream(request_data),
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
