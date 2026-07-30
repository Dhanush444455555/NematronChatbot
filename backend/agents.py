import os
import numpy as np
from openai import OpenAI
from duckduckgo_search import DDGS
from dotenv import load_dotenv
from typing import List, Dict, Any

# Load env vars relative to this file
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path, override=False)

# Core Agent Prompts
BASE_PROMPT = "You are a helpful, harmless, and highly intelligent AI assistant powered by NVIDIA Nemotron Ultra 550B."

CODING_AGENT = """You are an expert Coding Agent.
For any DSA (Data Structures and Algorithms) question, you MUST always structure your response with these 5 headers:
1. **Logic**: Explain the approach clearly.
2. **Dry Run**: Walk through an example step by step.
3. **Code**: Provide optimized, well-commented implementation (Support: C, C++, Java, Python, JavaScript, TypeScript, React, Node.js, FastAPI, Spring Boot, SQL, HTML, CSS).
4. **Time Complexity**: Analyze the time complexity.
5. **Space Complexity**: Analyze the space complexity.
For general coding questions, provide clean, production-ready code with explanations."""

DATA_ANALYSIS_AGENT = """You are a Data Analysis Agent.
You have been provided with data extracted from uploaded CSV or Excel files.
Your goals:
- Summarize the dataset structure, key statistics, and column types.
- Identify patterns, correlations, and anomalies.
- Answer specific user questions about the data.
- When asked, provide Python code using pandas/matplotlib/seaborn for charts or ML analysis.
- Suggest predictive approaches when relevant."""

PLANNER_AGENT = """You are a professional Planner Agent.
Help the user create:
- Study plans with day-wise breakdowns
- Daily/Weekly planners with time slots
- Project roadmaps with milestones
- Sprint planning with story points
- Goal tracking frameworks

Always use structured output: tables, bullet points, and clear headings. Be motivating and actionable."""

DOCUMENT_AGENT = """You are a Document Analysis Agent.
You have been provided with text extracted from uploaded documents (PDF, DOCX, TXT, PPTX, etc.).
Your goals:
- Answer questions accurately based on the document content.
- Summarize documents clearly with key takeaways.
- Extract tables, lists, and key information.
- Compare multiple documents when more than one is uploaded.
Always cite the relevant section/page when answering."""

VISION_AGENT = """You are a Vision Analysis Agent.
You have been provided with text extracted from images via OCR.
Your goals:
- Analyze screenshots and explain UI issues or errors.
- Decode diagrams, flowcharts, and architecture diagrams.
- Solve coding problems shown in screenshots.
- Understand and explain charts and graphs.
- Accurately read any text from images (signs, documents, whiteboards)."""

# Embedding configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "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")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nvidia/nemotron-3-embed-1b")

def get_embedding(text: str) -> List[float]:
    """Get semantic embedding using Nemotron Embed 1B."""
    try:
        client = OpenAI(api_key=NVIDIA_API_KEY, base_url=NVIDIA_BASE_URL)
        response = client.embeddings.create(
            model=EMBED_MODEL,
            input=text[:2048],  # cap to model limit
            encoding_format="float"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Embedding error: {e}")
        return []

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Calculate cosine similarity between two embeddings."""
    if not vec_a or not vec_b:
        return 0.0
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

def get_relevant_memories(user_query: str, memories: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
    """Use embedding similarity to find the most relevant memories."""
    if not memories:
        return []
    try:
        query_embedding = get_embedding(user_query)
        if not query_embedding:
            return memories[:top_k]

        scored = []
        for mem in memories:
            mem_text = mem.get("content", "")
            mem_embedding = mem.get("embedding")
            if not mem_embedding:
                mem_embedding = get_embedding(mem_text)
            score = cosine_similarity(query_embedding, mem_embedding)
            scored.append((score, mem))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in scored[:top_k]]
    except Exception as e:
        print(f"Memory retrieval error: {e}")
        return memories[:top_k]

# Web Search Helper
def perform_web_search(query: str) -> str:
    try:
        results = DDGS().text(query, max_results=6)
        search_context = "🌐 **Web Search Results:**\n"
        for r in results:
            title = r.get('title', '')
            body = r.get('body', '')
            href = r.get('href', '')
            search_context += f"\n**{title}**\n{body}\n🔗 {href}\n"
        return search_context
    except Exception as e:
        print(f"Search error: {e}")
        return "Web search is currently unavailable."

def determine_agent_and_prompt(user_message: str, files_data: List[Dict[str, Any]], memories: List[Dict[str, Any]]) -> str:
    """
    Analyzes user message and attached files to build the augmented system prompt.
    Uses Nemotron Embed 1B for semantic memory retrieval.
    """
    system_prompt = BASE_PROMPT + "\n\n"

    # 1. Inject semantically relevant memories
    relevant_memories = get_relevant_memories(user_message, memories)
    if relevant_memories:
        system_prompt += "📌 **User Preferences & Memory Context:**\n"
        for m in relevant_memories:
            system_prompt += f"- {m['content']}\n"
        system_prompt += "\n"

    # 2. Determine agent based on file types
    has_csv_excel = any(
        ext in f.get('content_type', '') or f.get('filename','').endswith(('.csv','.xlsx','.xls'))
        for f in files_data
        for ext in ['text/csv', 'excel', 'spreadsheet']
    )
    has_image = any('image' in f.get('content_type', '') for f in files_data)
    has_doc = any(
        ext in f.get('content_type', '') or f.get('filename','').endswith(('.pdf','.docx','.txt'))
        for f in files_data
        for ext in ['pdf', 'word', 'text/plain']
    )

    if has_csv_excel:
        system_prompt += DATA_ANALYSIS_AGENT + "\n\n"
    elif has_image:
        system_prompt += VISION_AGENT + "\n\n"
    elif has_doc:
        system_prompt += DOCUMENT_AGENT + "\n\n"

    # 3. Determine agent based on text intent
    msg_lower = user_message.lower()

    coding_keywords = ['code', 'debug', 'refactor', 'dsa', 'algorithm', 'function', 'class', 'python', 'javascript', 'react', 'java', 'c++', 'typescript', 'fastapi', 'node', 'sql', 'html', 'css', 'bug', 'error', 'fix', 'optimize']
    if any(k in msg_lower for k in coding_keywords) and not has_csv_excel:
        system_prompt += CODING_AGENT + "\n\n"

    planner_keywords = ['plan', 'roadmap', 'schedule', 'sprint', 'goals', 'study', 'planner', 'timeline', 'project', 'week']
    if any(k in msg_lower for k in planner_keywords):
        system_prompt += PLANNER_AGENT + "\n\n"

    # 4. Web Search agent (only when explicitly needed)
    search_keywords = ['search', 'latest', 'news', 'today', 'current', 'github', 'stackoverflow', 'research paper', 'find online', 'look up', 'recent']
    needs_search = any(k in msg_lower for k in search_keywords)

    if needs_search:
        system_prompt += "🔍 **You are acting as a Web Search Agent.** Use the search results below to answer accurately and always cite sources.\n"
        search_results = perform_web_search(user_message)
        system_prompt += f"\n{search_results}\n\n"

    # 5. Inject file context
    if files_data:
        system_prompt += "📎 **Attached Files Content:**\n"
        for f in files_data:
            fname = f.get('filename', 'Unknown')
            extracted = f.get('extracted_text', '').strip()
            if extracted:
                system_prompt += f"\n--- FILE: {fname} ---\n{extracted}\n--- END: {fname} ---\n"
        system_prompt += "\n"

    return system_prompt
