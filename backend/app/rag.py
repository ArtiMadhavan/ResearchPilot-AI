from typing import Any, Protocol


INSUFFICIENT_EVIDENCE = "Insufficient evidence was found in the research library to answer this question."
GEMINI_UNAVAILABLE = "Gemini generation is unavailable. The retrieved evidence is provided for review."


class Retriever(Protocol):
    def search(self, query: str, top_k: int = 5, paper_id: str | None = None) -> list[dict[str, Any]]: ...


class Generator(Protocol):
    @property
    def available(self) -> bool: ...

    async def generate(self, prompt: str) -> str | None: ...


class RAGService:
    def __init__(self, retriever: Retriever, generator: Generator, minimum_score: float = 0.2) -> None:
        self.retriever = retriever
        self.generator = generator
        self.minimum_score = minimum_score

    async def answer(self, question: str, top_k: int = 5, paper_id: str | None = None) -> dict[str, Any]:
        retrieved = self.retriever.search(question, top_k, paper_id)
        evidence = [item for item in retrieved if item["score"] >= self.minimum_score]
        if not evidence:
            return {"question": question, "answer": INSUFFICIENT_EVIDENCE, "sources": [], "status": "no_evidence", "model": None}

        prompt = build_evidence_prompt(question, evidence)
        answer = await self.generator.generate(prompt)
        return {
            "question": question,
            "answer": answer or GEMINI_UNAVAILABLE,
            "sources": [source_for(item) for item in evidence],
            "status": "generated" if answer else "fallback",
            "model": getattr(self.generator, "model", None) if answer else None,
        }


def build_evidence_prompt(question: str, evidence: list[dict[str, Any]]) -> str:
    context = "\n\n".join(
        f"[Paper ID: {item['paper_id']} | Title: {item['title']} | Chunk ID: {item['chunk_index']} | Similarity: {item['score']}]\n{item['text']}"
        for item in evidence
    )
    return f"""You are a research assistant.

Answer the user's question using ONLY the supplied research evidence.
If the evidence does not contain enough information to answer the question, explicitly say that the available evidence is insufficient.
Do not invent facts.
Do not fabricate citations.
Do not claim information that is not present in the retrieved evidence.

User question:
{question}

Supplied research evidence:
{context}
"""


def source_for(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "paper_id": item["paper_id"],
        "paper_title": item["title"],
        "chunk_id": item["chunk_index"],
        "similarity_score": item["score"],
        "evidence": item["text"],
    }