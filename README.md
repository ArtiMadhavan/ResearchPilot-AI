# ResearchPilot AI

An AI-powered research assistant for managing, reading, and analyzing academic papers. Upload PDFs, search them semantically, ask questions about your library, detect research gaps, compare papers, and generate citations — all in one place.

## Features

- **Library** — Import PDFs; papers get metadata extraction, keyword analysis, collections, tags, favorites, and notes.
- **Reader** — Embedded PDF viewer with a paper chooser, per-paper evidence highlighting (semantic retrieval filtered to the open paper), and persistent notes.
- **Semantic search** — Paper text is chunked (with boilerplate — references, copyright/declaration blocks, funding statements — filtered out), embedded with `all-MiniLM-L6-v2`, and indexed in FAISS for fast retrieval.
- **Ask your library (RAG chat)** — Grounded question answering via Gemini. Every answer shows its sources (paper titles + similarity scores). Falls back to retrieved evidence when no API key is set.
- **Intelligence** — Research gap detection from semantic queries, an actionable research roadmap, and structured cross-paper comparison.
- **Citations** — Auto-generate APA / IEEE / MLA citations from real paper metadata.
- **Analytics** — Keyword/year trends and K-Means clustering with silhouette scoring.

## Architecture

| Part | Stack | Location |
|---|---|---|
| Frontend | React + TypeScript, Vite, Tailwind, Radix UI, Clerk (auth) | `artifacts/researchpilot/` |
| Backend | FastAPI, SQLAlchemy (SQLite), PyMuPDF, spaCy, scikit-learn, pandas | `backend/app/` |
| Retrieval | sentence-transformers (`all-MiniLM-L6-v2`) + FAISS inner-product index | `backend/app/semantic.py` |
| LLM | Google Gemini (`gemini-3.6-flash` by default) via `backend/app/gemini.py` | optional, key-based |

Papers are stored on disk, text extracted with PyMuPDF, metadata/notes persisted in SQLite, and semantic chunks kept in an in-memory FAISS index rebuilt lazily from the DB.

## Getting started

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then fill in GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

The `.env` file supports:

```
GEMINI_API_KEY=your-key-here    # enables AI chat answers (free tier at AI Studio)
GEMINI_MODEL=gemini-3.6-flash
ENABLE_SPACY=1                  # optional: spaCy sentence segmentation
```

Interactive API docs: `http://localhost:8000/docs`

### 2. Frontend

```powershell
cd artifacts/researchpilot
npm install
npm run dev
```

## Key API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Health check |
| GET / POST | `/api/papers` | List / upload papers |
| PATCH | `/api/papers/{id}` | Update metadata, tags, notes |
| GET | `/api/papers/{id}/file` | Serve the PDF |
| GET | `/api/search?q=...&top_k=...&paper_id=...` | Semantic search (optionally scoped to one paper) |
| POST | `/api/chat` | RAG chat: `{ "question": "...", "top_k": 5, "paper_id": "..." }` |
| GET | `/api/intelligence/gaps` | Research gap detection |
| GET | `/api/intelligence/roadmap` | Research roadmap |
| GET | `/api/intelligence/comparison` | Cross-paper comparison |
| GET | `/api/analytics/clusters` · `/api/analytics/trends` | Analytics |
| POST | `/api/index/rebuild` | Re-chunk all papers and rebuild the FAISS index |

## Testing

Backend:

```powershell
$env:PYTHONPATH = "backend"
python -m pytest backend/tests -q
```

Frontend typecheck:

```powershell
cd artifacts/researchpilot
npm run typecheck
```

## Notes

- `backend/.env` is gitignored — never commit API keys.
- Without a Gemini key the app still works; chat returns the retrieved evidence instead of a generated answer.
- Run `POST /api/index/rebuild` after upgrading the chunker so existing papers are re-indexed.
