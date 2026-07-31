# 🤖 Nematron Agents — Advanced NVIDIA AI Client

A state-of-the-art web application powered by **NVIDIA NIM API**, **Nemotron 3 Ultra 550B Thinking Model**, and **Multimodal LLMs**. Features an intelligent agent router, chain-of-thought reasoning visualization, automatic vision model switching, user authentication, and multi-format document exports.

🌐 **Live Production App:** [https://nematron-chatbot.vercel.app](https://nematron-chatbot.vercel.app)

---

## ✨ Features

- 🧠 **Chain-of-Thought Thinking Mode**: Displays real-time reasoning thoughts using `nvidia/nemotron-3-ultra-550b-a55b` before returning the final answer.
- 👁️ **Automatic Vision Model Switching**: When an image is uploaded, the backend auto-routes the request to vision-capable models (`meta/llama-3.2-90b-vision-instruct` or `minimaxai/minimax-m3`) and updates the frontend in real-time.
- ⚡ **Multi-Agent Intelligent Router**:
  - **Coding Agent**: Structures Data Structures & Algorithms (DSA) answers with *Logic*, *Dry Run*, *Code*, *Time Complexity*, and *Space Complexity*.
  - **Document Analysis Agent**: Extracts and processes text from PDFs, DOCX, TXTs, and PPTX files.
  - **Data Analysis Agent**: Summarizes CSV/Excel data structures and columns.
  - **Vision Agent**: Analyzes images, charts, whiteboards, code screenshots, and diagrams.
  - **Planner Agent**: Generates structured study plans, project roadmaps, and sprint timelines.
  - **Web Search Agent**: Automatically performs live web searches for current information.
- 📄 **Multi-Format Exporting**:
  - **Export PDF**: Generates a clean printable document with styled message bubbles.
  - **Export Markdown (`.md`)**: Downloads full formatted markdown files.
  - **Export Text (`.txt`)**: Downloads clean plain text chat history.
- 🔐 **Authentication & Security**: Email/Password user registration, JWT authentication tokens, PBKDF2-HMAC-SHA256 password hashing, and hidden Admin user management panel.
- 🗄️ **Dual Database Support**: Works seamlessly with persistent **SQLite** for local development and **MongoDB Atlas** for serverless production deployments.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, Vite, Lucide Icons, Glassmorphism Vanilla CSS, KaTeX Math |
| **Backend** | Python 3.12, FastAPI, AsyncOpenAI, Uvicorn, PyPDF2 / pdfplumber, pandas |
| **Database** | SQLite (Local) / MongoDB Motor (Production) |
| **AI Integration** | NVIDIA NIM API (`https://integrate.api.nvidia.com/v1`) |
| **Deployment** | Vercel Serverless Functions (`api/index.py` + `frontend/dist`) |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+) & `npm`
- Python (v3.10+)

### 1. Clone the Repository
```bash
git clone https://github.com/Dhanush444455555/NematronChatbot.git
cd NematronChatbot
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
```

Set up your `.env` file inside `backend/.env`:
```env
NVIDIA_API_KEY=nvapi-your-key-here
JWT_SECRET=your-secure-jwt-secret
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-admin-password
```

Run the backend server:
```bash
python main.py
```
*Backend will run at `http://localhost:8000`.*

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*Frontend will run at `http://localhost:5173`.*

---

## 📚 API Reference

### Auth Endpoints
- `POST /api/auth/register` — Register a new user (`email`, `password`, `name`).
- `POST /api/auth/login` — Authenticate and receive a JWT token.
- `GET /api/auth/me` — Get current logged-in user details.

### Chat & Streaming Endpoints
- `POST /api/chat` — Server-Sent Events (SSE) streaming completion endpoint supporting reasoning steps, vision inputs, and auto-switching.
- `GET /api/chats` — Fetch user's saved conversation history.
- `GET /api/chats/{chat_id}` — Get message trajectory for a specific chat.
- `PUT /api/chats/{chat_id}` — Rename a chat title.
- `DELETE /api/chats/{chat_id}` — Delete a chat.

### File Upload Endpoint
- `POST /api/upload` — Upload files (PDF, DOCX, CSV, XLSX, PNG, JPG) for agent ingestion.

---

## 📖 User Guide

1. **Register/Login**: Access the web app, enter your details on the login page to start a secure session.
2. **Ask Questions or Request Code**: Type any coding, planning, or general prompt. For DSA questions, Nematron will automatically apply the 5-step structured answer format.
3. **Upload Files/Images**: Click the attachment button or drag files into the chat. Images automatically trigger the **Vision Agent** and switch to a vision-capable LLM.
4. **Export Conversations**: Use the **Export** button in the top right header to save your work as **PDF**, **Markdown**, or **TXT**.

---

## 🌐 Deploying to Vercel

The project includes pre-configured `vercel.json` for zero-config Vercel deployment:
```bash
npx vercel --prod
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
