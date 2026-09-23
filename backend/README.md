# ResearchPilot AI backend

FastAPI service for paper ingestion and local analysis.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

For a containerized run:

```powershell
copy .env.example .env
docker compose up --build
```

API documentation is available at `http://localhost:8000/docs`.

## Endpoints

- `GET /healthz`
- `GET /api/papers`
- `POST /api/papers` with a multipart `file` PDF field
- `GET /api/search?q=cloud+analytics&top_k=5`
- `POST /api/chat` with `{ "question": "...", "top_k": 5, "paper_id": "..." }`
- `GET /api/intelligence/gaps?top_k=3`
- `GET /api/intelligence/roadmap?top_k=3`
- `GET /api/intelligence/comparison`
- `GET /api/analytics/clusters`
- `GET /api/analytics/trends`

The service stores PDFs locally, extracts and normalizes text with PyMuPDF, supports spaCy sentence segmentation through `ENABLE_SPACY=1`, persists metadata and analysis in SQLite, and derives keywords with TF-IDF. With spaCy disabled, a deterministic sentence splitter keeps lightweight API and test processes stable. Semantic search chunks paper text, embeds chunks with `all-MiniLM-L6-v2`, and retrieves them through a FAISS inner-product index. The RAG endpoint reuses that retrieval layer, builds a strict evidence-only prompt, and calls Gemini when `GEMINI_API_KEY` is configured. Without Gemini credentials, it returns a controlled fallback with the retrieved sources. Research intelligence endpoints currently provide evidence-linked heuristic gaps, roadmap steps, and paper metadata comparison; stronger cross-paper conclusions require multiple uploaded papers. Analytics adds Pandas keyword/year trends and K-Means clustering with silhouette scoring; clustering explicitly reports insufficient data below two papers.

Run backend tests with:

```powershell
$env:PYTHONPATH = "backend"
python -m pytest backend/tests -q
```
