from types import SimpleNamespace

from app.intelligence import build_roadmap, compare_papers, detect_gaps


class Retriever:
    def search(self, query, top_k=3, paper_id=None):
        return [{
            "paper_id": "paper-1",
            "title": "Research Paper",
            "text": "Future work should evaluate the method across more datasets. The current evaluation covers a single benchmark, and the authors note that results may not generalize beyond it. A broader comparison against alternative baselines remains unexplored.",
            "chunk_index": 2,
            "score": 0.61,
        }]


def test_gap_detection_deduplicates_evidence():
    gaps = detect_gaps(Retriever())
    assert len(gaps) == 1
    assert gaps[0]["paper_id"] == "paper-1"


def test_roadmap_keeps_source_reference():
    roadmap = build_roadmap([{
        "gap_type": "future_work",
        "title": "Future work proposed by the source evidence",
        "evidence": "Evaluate across more datasets.",
        "paper_id": "paper-1",
        "paper_title": "Research Paper",
        "chunk_id": 2,
        "similarity_score": 0.61,
    }])
    assert roadmap[0]["source"]["chunk_id"] == 2
    assert "methodology" in roadmap[0]


def test_comparison_exposes_paper_analysis():
    paper = SimpleNamespace(
        id="paper-1",
        title="Research Paper",
        created_at=None,
        keywords="nlp,embeddings",
        abstract="A research abstract.",
        source_metadata="{}",
        sentence_count=12,
    )
    comparison = compare_papers([paper])
    assert comparison[0]["keywords"] == ["nlp", "embeddings"]
    assert comparison[0]["sentence_count"] == 12
