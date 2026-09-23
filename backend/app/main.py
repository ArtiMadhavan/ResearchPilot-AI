import json
import os
import ssl
from pathlib import Path
from uuid import uuid4

# Bypass SSL certificate verification globally.
# Required on Windows where the system CA bundle may not include the root CAs
# needed to reach huggingface.co or generativelanguage.googleapis.com.
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""
os.environ["HF_HUB_DISABLE_SSL_VERIFICATION"] = "1"
ssl._create_default_https_context = ssl._create_unverified_context  # noqa: SLF001

import requests as _requests  # patch requests session to skip SSL verify

_orig_send = _requests.Session.send


def _no_verify_send(self, request, **kwargs):  # type: ignore[no-untyped-def]
    kwargs["verify"] = False
    return _orig_send(self, request, **kwargs)


_requests.Session.send = _no_verify_send  # type: ignore[method-assign]

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import DateTime, Integer, String, Text, create_engine, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from datetime import datetime, timezone

from .analysis import analyze_text, extract_pdf
from .analytics import cluster_papers, research_trends
from .gemini import GeminiService
from .intelligence import build_roadmap, compare_papers, detect_gaps
from .rag import RAGService
from .semantic import SemanticIndex

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "storage"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{BASE_DIR / 'researchpilot.db'}", connect_args={"check_same_thread": False})
semantic_index: SemanticIndex | None = None
rag_service: RAGService | None = None


class Base(DeclarativeBase):
    pass


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    abstract: Mapped[str] = mapped_column(Text, default="")
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[str] = mapped_column(Text, default="")
    sentence_count: Mapped[int] = mapped_column(Integer, default=0)
    source_metadata: Mapped[str] = mapped_column(Text, default="{}")
    owner_email: Mapped[str] = mapped_column(String(320), default="legacy")
    collection: Mapped[str] = mapped_column(String(200), default="My library")
    tags: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    favorite: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)

with engine.begin() as connection:
    columns = {
        row[1] for row in connection.execute(text("PRAGMA table_info(papers)"))
    }
    if "sentence_count" not in columns:
        connection.execute(text("ALTER TABLE papers ADD COLUMN sentence_count INTEGER NOT NULL DEFAULT 0"))
    if "source_metadata" not in columns:
        connection.execute(text("ALTER TABLE papers ADD COLUMN source_metadata TEXT NOT NULL DEFAULT '{}'"))
    if "owner_email" not in columns:
        connection.execute(text("ALTER TABLE papers ADD COLUMN owner_email VARCHAR(320) NOT NULL DEFAULT 'legacy'"))
    if "collection" not in columns:
        connection.execute(text("ALTER TABLE papers ADD COLUMN collection VARCHAR(200) NOT NULL DEFAULT 'My library'"))
    if "tags" not in columns:
        connection.execute(text("ALTER TABLE papers ADD COLUMN tags TEXT NOT NULL DEFAULT ''"))
    if "notes" not in columns:
        connection.execute(text("ALTER TABLE papers ADD COLUMN notes TEXT NOT NULL DEFAULT ''"))
    if "favorite" not in columns:
        connection.execute(text("ALTER TABLE papers ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0"))

app = FastAPI(title="ResearchPilot AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PaperResponse(BaseModel):
    id: str
    title: str
    filename: str
    abstract: str
    keywords: list[str]
    sentence_count: int
    source_metadata: dict[str, str]
    created_at: datetime
    collection: str
    tags: list[str]
    notes: str
    favorite: bool


class PaperUpdate(BaseModel):
    title: str | None = None
    collection: str | None = None
    tags: list[str] | None = None
    notes: str | None = None
    favorite: bool | None = None


class SemanticSearchResult(BaseModel):
    paper_id: str
    title: str
    text: str
    chunk_index: int
    score: float


class ChatRequest(BaseModel):
    question: str
    top_k: int = 5
    paper_id: str | None = None


class ChatResponse(BaseModel):
    question: str
    answer: str
    sources: list[dict[str, object]]
    status: str
    model: str | None


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/papers", response_model=list[PaperResponse])
def list_papers(x_user_email: str | None = Header(default=None)) -> list[PaperResponse]:
    owner_email = x_user_email or "anonymous"
    with Session(engine) as session:
        papers = session.scalars(select(Paper).where(Paper.owner_email == owner_email).order_by(Paper.created_at.desc())).all()
        return [to_response(paper) for paper in papers]


@app.get("/api/papers/{paper_id}/file")
def paper_file(paper_id: str) -> FileResponse:
    stored_path = UPLOAD_DIR / f"{paper_id}.pdf"
    if not stored_path.is_file():
        raise HTTPException(status_code=404, detail="Paper PDF not found")
    return FileResponse(stored_path, media_type="application/pdf", content_disposition_type="inline")


@app.patch("/api/papers/{paper_id}", response_model=PaperResponse)
def update_paper(paper_id: str, update: PaperUpdate, x_user_email: str | None = Header(default=None)) -> PaperResponse:
    owner_email = x_user_email or "anonymous"
    with Session(engine) as session:
        paper = session.scalar(select(Paper).where(Paper.id == paper_id, Paper.owner_email == owner_email))
        if paper is None:
            raise HTTPException(status_code=404, detail="Paper not found")
        values = update.model_dump(exclude_unset=True)
        if "tags" in values:
            values["tags"] = ",".join(values["tags"])
        for key, value in values.items():
            setattr(paper, key, value)
        session.commit()
        session.refresh(paper)
        return to_response(paper)


@app.get("/api/search", response_model=list[SemanticSearchResult])
def semantic_search(q: str, top_k: int = 5, paper_id: str | None = None) -> list[SemanticSearchResult]:
    if top_k < 1 or top_k > 20:
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 20")
    index = get_semantic_index()
    ensure_index_loaded(index)
    return [SemanticSearchResult(**result) for result in index.search(q, top_k, paper_id)]


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    if request.top_k < 1 or request.top_k > 20:
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 20")
    index = get_semantic_index()
    ensure_index_loaded(index)
    service = get_rag_service(index)
    result = await service.answer(request.question.strip(), request.top_k, request.paper_id)
    return ChatResponse(**result)


@app.get("/api/intelligence/gaps")
def research_gaps(top_k: int = 3) -> list[dict[str, object]]:
    index = get_semantic_index()
    ensure_index_loaded(index)
    return detect_gaps(index, top_k)


@app.get("/api/intelligence/roadmap")
def research_roadmap(top_k: int = 3) -> list[dict[str, object]]:
    index = get_semantic_index()
    ensure_index_loaded(index)
    return build_roadmap(detect_gaps(index, top_k))


@app.get("/api/intelligence/comparison")
def paper_comparison() -> list[dict[str, object]]:
    with Session(engine) as session:
        papers = session.scalars(select(Paper).order_by(Paper.created_at.desc())).all()
        return compare_papers(papers)


@app.post("/api/index/rebuild")
def rebuild_index() -> dict[str, object]:
    """Re-chunk and re-embed every stored paper with the current chunker."""
    global semantic_index
    index = get_semantic_index()
    with Session(engine) as session:
        papers = session.scalars(select(Paper)).all()
        rebuilt = SemanticIndex()
        total_chunks = 0
        for paper in papers:
            total_chunks += rebuilt.add_paper(paper.id, paper.title, paper.extracted_text)
        semantic_index = rebuilt
    if rag_service is not None:
        rag_service.retriever = semantic_index
    return {"status": "ok", "papers_indexed": len(papers), "chunks_indexed": total_chunks}


@app.get("/api/analytics/clusters")
def analytics_clusters() -> dict[str, object]:
    with Session(engine) as session:
        papers = session.scalars(select(Paper).order_by(Paper.created_at.desc())).all()
        return cluster_papers(papers)


@app.get("/api/analytics/trends")
def analytics_trends() -> dict[str, object]:
    with Session(engine) as session:
        papers = session.scalars(select(Paper).order_by(Paper.created_at.desc())).all()
        return research_trends(papers)


@app.post("/api/papers", response_model=PaperResponse, status_code=status.HTTP_201_CREATED)
async def upload_paper(file: UploadFile = File(...), x_user_email: str | None = Header(default=None)) -> PaperResponse:
    if file.content_type != "application/pdf" and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty")

    paper_id = str(uuid4())
    filename = Path(file.filename).name
    stored_path = UPLOAD_DIR / f"{paper_id}.pdf"
    stored_path.write_bytes(content)

    try:
        extracted_text, source_metadata = extract_pdf(content)
    except ValueError as error:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(error)) from error

    analysis = analyze_text(extracted_text)
    paper = Paper(
        id=paper_id,
        title=Path(filename).stem.replace("_", " ").replace("-", " ").strip(),
        filename=filename,
        abstract=analysis["abstract"],
        extracted_text=extracted_text,
        keywords=",".join(analysis["keywords"]),
        sentence_count=analysis["sentence_count"],
        source_metadata=json.dumps(source_metadata),
        owner_email=x_user_email or "anonymous",
        collection="My library",
    )
    with Session(engine) as session:
        session.add(paper)
        session.commit()
        session.refresh(paper)
        index = get_semantic_index()
        index.add_paper(paper.id, paper.title, paper.extracted_text)
        return to_response(paper)


def get_semantic_index() -> SemanticIndex:
    global semantic_index
    if semantic_index is None:
        try:
            semantic_index = SemanticIndex()
        except Exception as error:
            raise HTTPException(status_code=503, detail=f"Semantic search is unavailable: {error}") from error
    return semantic_index


def get_rag_service(index: SemanticIndex) -> RAGService:
    global rag_service
    if rag_service is None or rag_service.retriever is not index:
        rag_service = RAGService(index, GeminiService())
    return rag_service


def ensure_index_loaded(index: SemanticIndex) -> None:
    if index.chunks:
        return
    with Session(engine) as session:
        papers = session.scalars(select(Paper)).all()
        for paper in papers:
            index.add_paper(paper.id, paper.title, paper.extracted_text)


def to_response(paper: Paper) -> PaperResponse:
    return PaperResponse(
        id=paper.id,
        title=paper.title,
        filename=paper.filename,
        abstract=paper.abstract,
        keywords=[keyword for keyword in paper.keywords.split(",") if keyword],
        sentence_count=paper.sentence_count,
        source_metadata=json.loads(paper.source_metadata or "{}"),
        created_at=paper.created_at,
        collection=paper.collection,
        tags=[tag for tag in paper.tags.split(",") if tag],
        notes=paper.notes,
        favorite=bool(paper.favorite),
    )
