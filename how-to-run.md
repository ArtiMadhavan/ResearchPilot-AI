# How to Run — ResearchPilot AI

ResearchPilot AI is a research intelligence workspace for organizing papers, reading evidence, discovering research gaps, and preparing citations. It consists of two main services:

| Service | Technology | Port |
|---|---|---|
| **Python Backend (FastAPI)** | Python 3.11, FastAPI, SQLite, FAISS, Gemini | `8000` |
| **Frontend (React + Vite)** | React 19, Vite 7, TypeScript, TailwindCSS | `5173` (dev) |
| **Node.js API Server** | Express 5, Drizzle ORM, PostgreSQL | `5000` |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 24+ | [nodejs.org](https://nodejs.org) |
| pnpm | latest | `npm install -g pnpm` |
| Docker (optional) | latest | [docker.com](https://docker.com) |

---

## 1. Clone & Install

```powershell
# Clone the repository
git clone <repo-url>
cd ResearchPilot-AI

# Install all Node.js/frontend dependencies (from root)
pnpm install
```

---

## 2. Python Backend (FastAPI)

The backend handles PDF ingestion, semantic search (FAISS), RAG chat with Gemini, and research intelligence endpoints.

### 2a. Local (Recommended for development)

```powershell
# Navigate into the backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install Python dependencies
pip install -r requirements.txt

# Copy the environment config
copy .env.example .env
```

> **Edit `.env`** to set your optional `GEMINI_API_KEY`. Without it, the chat endpoint uses a controlled fallback response.

```powershell
# Start the backend server (with hot-reload)
uvicorn app.main:app --reload --port 8000
```

API is now live at **http://localhost:8000**  
Interactive API docs: **http://localhost:8000/docs**

### 2b. Docker (containerized)

```powershell
# From the backend/ directory
cd backend
copy .env.example .env

# Build and start the container
docker compose up --build

# Run in background
docker compose up --build -d

# Stop the container
docker compose down
```

---

## 3. Frontend — React + Vite

The frontend is a React 19 + Vite 7 app with full local state seeded with research content.

```powershell
# Navigate into the frontend directory
cd artifacts\researchpilot

# Set required env vars and start the Vite dev server
$env:PORT = "5173"; $env:BASE_PATH = "/"; node .\node_modules\vite\bin\vite.js --config vite.config.ts
```

Frontend is now live at **http://localhost:5173**

> **Why this command?** The `vite.config.ts` was originally built for Replit and requires `PORT` and `BASE_PATH` environment variables. The root `package.json` also has a `preinstall` script that uses `sh` (Linux/macOS only), so running from within the package directory avoids that issue on Windows.

### Other frontend commands

```powershell
# Build for production
$env:PORT = "5173"; $env:BASE_PATH = "/"; node .\node_modules\vite\bin\vite.js --config vite.config.ts build

# Type-check the frontend
node .\node_modules\.bin\tsc -p tsconfig.json --noEmit
```

---

## 4. Node.js API Server (Express + PostgreSQL)

The Node.js API server provides the persistence layer using Drizzle ORM and PostgreSQL. It requires a `DATABASE_URL` environment variable.

```powershell
# Set the required environment variable
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/researchpilot"

# Run the API server (dev mode — builds then starts)
pnpm --filter @workspace/api-server run dev
```

Server starts on **http://localhost:5000**

### Other API server commands

```powershell
# Build only (esbuild CJS bundle)
pnpm --filter @workspace/api-server run build

# Start already-built server
pnpm --filter @workspace/api-server run start

# Type-check the API server
pnpm --filter @workspace/api-server run typecheck
```

---

## 5. Backend Tests

```powershell
# From the repo root, set PYTHONPATH and run pytest
$env:PYTHONPATH = "backend"
python -m pytest backend/tests -q
```

---

## 6. Workspace-level Commands (from repo root)

These commands operate across all packages in the monorepo.

```powershell
# Full typecheck across all packages
pnpm run typecheck

# Typecheck + build all packages
pnpm run build

# Regenerate API hooks and Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only — requires DATABASE_URL)
pnpm --filter @workspace/db run push
```

---

## 7. Environment Variables Reference

All variables live in `backend/.env` (copy from `backend/.env.example`).

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | _(empty)_ | Optional. Enables Gemini-powered RAG chat. Without it, a fallback response is returned. |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use for RAG. |
| `ENABLE_SPACY` | `0` | Set to `1` to use spaCy sentence segmentation. Default uses a lightweight deterministic splitter. |
| `DATABASE_URL` | `sqlite:///./researchpilot.db` | SQLite path (default) or PostgreSQL connection string. |

---

## 8. API Endpoints (Backend)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Health check |
| `GET` | `/api/papers` | List all uploaded papers |
| `POST` | `/api/papers` | Upload a PDF (multipart/form-data, field: `file`) |
| `GET` | `/api/search?q=...&top_k=5` | Semantic search across papers |
| `POST` | `/api/chat` | RAG chat — `{ "question": "...", "top_k": 5, "paper_id": "..." }` |
| `GET` | `/api/intelligence/gaps?top_k=3` | Research gap detection |
| `GET` | `/api/intelligence/roadmap?top_k=3` | Suggested research roadmap |
| `GET` | `/api/intelligence/comparison` | Side-by-side paper comparison |
| `GET` | `/api/analytics/clusters` | K-Means paper clustering |
| `GET` | `/api/analytics/trends` | Keyword & year trend analysis |

---

## 9. Project Structure

```
ResearchPilot-AI/
├── backend/                  # Python FastAPI service
│   ├── app/
│   │   ├── main.py           # FastAPI app & all route definitions
│   │   ├── analysis.py       # Text extraction & TF-IDF keywords
│   │   ├── semantic.py       # FAISS embedding & semantic search
│   │   ├── rag.py            # Retrieval-Augmented Generation
│   │   ├── gemini.py         # Gemini API integration
│   │   ├── intelligence.py   # Gap, roadmap & comparison endpoints
│   │   └── analytics.py      # Clustering & trend analytics
│   ├── tests/                # pytest test suite
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── artifacts/
│   ├── researchpilot/        # React + Vite frontend
│   └── api-server/           # Express 5 Node.js API server
│
├── lib/
│   └── api-spec/             # OpenAPI spec (source of truth for API contracts)
│
├── scripts/                  # Workspace-level helper scripts
├── package.json              # Root pnpm workspace
├── pnpm-workspace.yaml       # Workspace & catalog config
└── how-to-run.md             # This file
```

---

## Quick Start (TL;DR)

Open **two terminal windows**:

**Terminal 1 — Python Backend:**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — React Frontend:**
```powershell
pnpm install
pnpm --filter @workspace/researchpilot run dev
```

Then open **http://localhost:5173** in your browser. 🚀
