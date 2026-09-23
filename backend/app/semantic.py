import os
import ssl
from dataclasses import dataclass
from typing import Any

import faiss
import numpy as np

# Bypass SSL certificate verification for HuggingFace model downloads.
# Required on Windows machines where the system CA bundle is incomplete.
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""
os.environ["HF_HUB_DISABLE_SSL_VERIFICATION"] = "1"
os.environ["TRANSFORMERS_NO_PROXY"] = ""
ssl._create_default_https_context = ssl._create_unverified_context  # noqa: SLF001

import requests as _requests  # patch requests session to skip SSL verify
from requests.adapters import HTTPAdapter as _HTTPAdapter

_orig_send = _requests.Session.send


def _no_verify_send(self, request, **kwargs):  # type: ignore[no-untyped-def]
    kwargs["verify"] = False
    return _orig_send(self, request, **kwargs)


_requests.Session.send = _no_verify_send  # type: ignore[method-assign]


@dataclass
class EvidenceChunk:
    paper_id: str
    title: str
    text: str
    chunk_index: int


class SemanticIndex:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        self.index = faiss.IndexFlatIP(self.dimension)
        self.chunks: list[EvidenceChunk] = []

    def add_paper(self, paper_id: str, title: str, text: str) -> int:
        paper_chunks = chunk_text(text)
        if not paper_chunks:
            return 0
        vectors = self.model.encode(paper_chunks, normalize_embeddings=True)
        self.index.add(np.asarray(vectors, dtype="float32"))
        start_index = len(self.chunks)
        self.chunks.extend(
            EvidenceChunk(paper_id, title, chunk, start_index + offset)
            for offset, chunk in enumerate(paper_chunks)
        )
        return len(paper_chunks)

    def search(self, query: str, top_k: int = 5, paper_id: str | None = None) -> list[dict[str, Any]]:
        if not query.strip() or not self.chunks:
            return []
        vector = self.model.encode([query], normalize_embeddings=True)
        search_limit = len(self.chunks) if paper_id else min(top_k, len(self.chunks))
        scores, indices = self.index.search(np.asarray(vector, dtype="float32"), search_limit)
        results = []
        for score, index in zip(scores[0], indices[0]):
            if index < 0:
                continue
            chunk = self.chunks[int(index)]
            if paper_id and chunk.paper_id != paper_id:
                continue
            results.append({
                "paper_id": chunk.paper_id,
                "title": chunk.title,
                "text": chunk.text,
                "chunk_index": chunk.chunk_index,
                "score": round(float(score), 4),
            })
        return results


BOILERPLATE_MARKERS = (
    "declaration of competing interest",
    "competing interests",
    "conflict of interest",
    "conflicts of interest",
    "the authors declare that",
    "author contributions",
    "authors' contributions",
    "acknowledg",
    "funding",
    "financial support",
    "no external funding",
    "data availability",
    "ethics approval",
    "informed consent",
    "open access",
    "creative commons",
    "copyright",
    "all rights reserved",
    " Springer Nature",
    " Elsevier ",
    " IEEE ",
    "publisher's note",
    "disclaimer",
    "received:",
    "accepted:",
    "published:",
    "corresponding author",
    "email:",
    "e-mail:",
    "doi:",
    "issn",
    "vol.",
    "vol ",
    "supplementary material",
    "appendix a",
    "orcid",
)


def _is_boilerplate(sentence: str) -> bool:
    lowered = " " + sentence.lower() + " "
    return any(marker in lowered for marker in BOILERPLATE_MARKERS)


def chunk_text(text: str, sentences_per_chunk: int = 6, min_chunk_chars: int = 200) -> list[str]:
    """Split text into content-rich chunks.

    Skips reference/bibliography sections and boilerplate (author declarations,
    copyright, funding, publication metadata), and drops tiny fragments so that
    indexed chunks carry real paper content.
    """
    lines = text.split("\n")
    body_lines: list[str] = []
    in_references = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if len(stripped) < 25 and stripped.lower().rstrip(":") in {
            "references", "bibliography", "works cited", "citations",
            "acknowledgments", "acknowledgements", "acknowledgement",
        }:
            in_references = True
            continue
        if in_references:
            continue
        body_lines.append(stripped)
    body = " ".join(body_lines)
    sentences = [sentence.strip() for sentence in body.replace(". ", ".\n").split("\n") if sentence.strip()]
    sentences = [sentence for sentence in sentences if len(sentence) > 40 and not _is_boilerplate(sentence)]
    chunks: list[str] = []
    for offset in range(0, len(sentences), sentences_per_chunk):
        window = sentences[offset : offset + sentences_per_chunk]
        chunk = " ".join(window).strip()
        if len(chunk) >= min_chunk_chars and not _is_boilerplate(chunk):
            chunks.append(chunk)
    return chunks
