import pytest

from app.rag import GEMINI_UNAVAILABLE, INSUFFICIENT_EVIDENCE, RAGService, build_evidence_prompt


EVIDENCE = {
    "paper_id": "paper-1",
    "title": "CivicLens Overview",
    "text": "AI classifies civic issues and publishes structured reports.",
    "chunk_index": 0,
    "score": 0.74,
}


class FakeRetriever:
    def __init__(self, results):
        self.results = results
        self.calls = []

    def search(self, query, top_k=5, paper_id=None):
        self.calls.append((query, top_k, paper_id))
        return self.results


class FakeGenerator:
    model = "fake-gemini"
    available = True

    def __init__(self, answer=None):
        self.answer = answer
        self.prompt = None

    async def generate(self, prompt):
        self.prompt = prompt
        return self.answer


@pytest.mark.anyio
async def test_rag_retrieves_evidence_and_builds_prompt():
    retriever = FakeRetriever([EVIDENCE])
    generator = FakeGenerator("AI classifies and publishes civic reports.")
    result = await RAGService(retriever, generator).answer("What does AI do?", paper_id="paper-1")

    assert result["status"] == "generated"
    assert result["sources"][0]["paper_id"] == "paper-1"
    assert "What does AI do?" in generator.prompt
    assert "CivicLens Overview" in generator.prompt
    assert retriever.calls == [("What does AI do?", 5, "paper-1")]


@pytest.mark.anyio
async def test_missing_gemini_returns_controlled_fallback():
    result = await RAGService(FakeRetriever([EVIDENCE]), FakeGenerator()).answer("What does AI do?")

    assert result["status"] == "fallback"
    assert result["answer"] == GEMINI_UNAVAILABLE
    assert result["sources"]


@pytest.mark.anyio
async def test_no_evidence_does_not_call_generator():
    generator = FakeGenerator("should not be called")
    result = await RAGService(FakeRetriever([]), generator).answer("Unknown question")

    assert result["status"] == "no_evidence"
    assert result["answer"] == INSUFFICIENT_EVIDENCE
    assert generator.prompt is None


def test_prompt_contains_strict_grounding_instruction():
    prompt = build_evidence_prompt("What does AI do?", [EVIDENCE])

    assert "ONLY the supplied research evidence" in prompt
    assert "Do not invent facts" in prompt
    assert "Similarity: 0.74" in prompt
