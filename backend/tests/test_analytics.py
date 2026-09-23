from datetime import datetime, timezone
from types import SimpleNamespace

from app.analytics import cluster_papers, research_trends


def paper(identifier, title, abstract, keywords):
    return SimpleNamespace(
        id=identifier,
        title=title,
        abstract=abstract,
        keywords=keywords,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def test_clustering_reports_insufficient_data():
    result = cluster_papers([paper("1", "One", "only paper", "single")])
    assert result["status"] == "insufficient_data"
    assert result["assignments"] == []


def test_clustering_assigns_multiple_papers():
    papers = [
        paper("1", "Cloud storage", "distributed cloud storage systems", "cloud,storage"),
        paper("2", "Language models", "natural language processing models", "nlp,language"),
        paper("3", "Cloud analytics", "cloud data analytics systems", "cloud,analytics"),
    ]
    result = cluster_papers(papers)
    assert result["status"] == "ok"
    assert len(result["assignments"]) == 3
    assert result["cluster_count"] == 2
    assert result["silhouette_score"] is not None


def test_trends_returns_keyword_frequency():
    result = research_trends([paper("1", "Paper", "abstract", "cloud,nlp,cloud")])
    assert result["paper_count"] == 1
    assert result["ingestion_years"][0]["paper_count"] == 1
    assert result["keyword_frequency"][0] == {"keyword": "cloud", "paper_count": 2}
