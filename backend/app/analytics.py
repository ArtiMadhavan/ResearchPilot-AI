from collections import Counter
from typing import Any

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score


def cluster_papers(papers: list[Any]) -> dict[str, Any]:
    if len(papers) < 2:
        return {"status": "insufficient_data", "message": "At least 2 papers are required for clustering.", "clusters": [], "assignments": []}

    documents = [f"{paper.title} {paper.abstract} {paper.keywords.replace(',', ' ')}" for paper in papers]
    matrix = TfidfVectorizer(stop_words="english", max_features=200).fit_transform(documents)
    cluster_count = min(max(2, round(len(papers) ** 0.5)), len(papers) - 1)
    labels = KMeans(n_clusters=cluster_count, random_state=42, n_init=10).fit_predict(matrix)
    score = silhouette_score(matrix, labels) if len(set(labels)) > 1 else None
    counts = Counter(int(label) for label in labels)
    return {
        "status": "ok",
        "cluster_count": cluster_count,
        "silhouette_score": round(float(score), 4) if score is not None else None,
        "clusters": [{"cluster_id": cluster_id, "paper_count": counts[cluster_id]} for cluster_id in sorted(counts)],
        "assignments": [
            {"paper_id": paper.id, "title": paper.title, "cluster_id": int(label)}
            for paper, label in zip(papers, labels)
        ],
    }


def research_trends(papers: list[Any]) -> dict[str, Any]:
    rows = [
        {
            "paper_id": paper.id,
            "title": paper.title,
            "ingestion_year": paper.created_at.year if paper.created_at else None,
            "keywords": [keyword for keyword in paper.keywords.split(",") if keyword],
        }
        for paper in papers
    ]
    frame = pd.DataFrame(rows)
    if frame.empty:
        return {"status": "empty", "ingestion_years": [], "keyword_frequency": [], "paper_count": 0}

    year_counts = (
        frame.dropna(subset=["ingestion_year"])
        .groupby("ingestion_year")
        .size()
        .reset_index(name="paper_count")
        .to_dict(orient="records")
    )
    keyword_counts = Counter(keyword for keywords in frame["keywords"] for keyword in keywords)
    return {
        "status": "ok",
        "paper_count": len(frame),
        "ingestion_years": year_counts,
        "keyword_frequency": [
            {"keyword": keyword, "paper_count": count}
            for keyword, count in keyword_counts.most_common(20)
        ],
    }
