import json
import re
from typing import Any


GAP_QUERIES = [
    ("limitations", "Limitations and constraints described in the research evidence."),
    ("future_work", "Future work and unresolved research problems described in the evidence."),
    ("method_gap", "Missing methods, weak evaluation, or underexplored comparisons in the evidence."),
]


def detect_gaps(retriever: Any, top_k: int = 3) -> list[dict[str, Any]]:
    gaps: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()
    per_type_limit = max(top_k, 2)
    for gap_type, query in GAP_QUERIES:
        added_for_type = 0
        for evidence in retriever.search(query, top_k * 3):
            key = (evidence["paper_id"], evidence["chunk_index"])
            text = evidence["text"].strip()
            if key in seen or evidence["score"] < 0.3:
                continue
            # Require substantive evidence: real sentences, not stubs.
            if len(text) < 150 or text.count(".") < 2:
                continue
            seen.add(key)
            gaps.append({
                "gap_type": gap_type,
                "title": title_for(gap_type),
                "evidence": text,
                "paper_id": evidence["paper_id"],
                "paper_title": evidence["title"],
                "chunk_id": evidence["chunk_index"],
                "similarity_score": evidence["score"],
            })
            added_for_type += 1
            if added_for_type >= per_type_limit:
                break
    gaps.sort(key=lambda gap: gap["similarity_score"], reverse=True)
    return gaps


ROADMAP_TEMPLATES = {
    "limitations": {
        "objective": "Re-test the reported results under the constraints the source acknowledges ({topic}), so the boundary conditions are mapped rather than assumed.",
        "methodology": "Replicate the core evaluation on a broader sample, document where results diverge, and report failure modes alongside successes.",
        "metrics": ["replication coverage", "divergence rate", "reported confidence"],
        "phase": "next",
    },
    "future_work": {
        "objective": "Advance the direction proposed in the evidence ({topic}) into a concrete, measurable study design.",
        "methodology": "Convert the proposed direction into hypotheses, select datasets or settings where they are testable, and define success criteria before data collection.",
        "metrics": ["hypothesis clarity", "dataset fit", "pre-registered criteria"],
        "phase": "then",
    },
    "method_gap": {
        "objective": "Introduce a stronger evaluation method for {topic} that the current evidence base lacks, and benchmark it against existing approaches.",
        "methodology": "Survey the methods used across your library, identify the weakest shared evaluation practice, and design a comparison study that addresses it directly.",
        "metrics": ["baseline coverage", "comparison quality", "reproducibility"],
        "phase": "later",
    },
}


def build_roadmap(gaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for index, gap in enumerate(gaps):
        template = ROADMAP_TEMPLATES.get(gap["gap_type"], ROADMAP_TEMPLATES["method_gap"])
        topic = _topic_hint(gap["evidence"])
        steps.append({
            "step": index + 1,
            "gap": gap["title"],
            "problem": gap["evidence"],
            "objective": template["objective"].format(topic=topic),
            "methodology": template["methodology"],
            "metrics": template["metrics"],
            "phase": template["phase"],
            "source": {key: gap[key] for key in ("paper_id", "paper_title", "chunk_id", "similarity_score")},
        })
    return steps


def _topic_hint(evidence: str) -> str:
    """Extract a short topic phrase from the evidence text for templates."""
    words = [word.strip(".,;:()\"'") for word in evidence.split()]
    stop = {"the", "a", "an", "of", "in", "on", "for", "and", "or", "to", "with", "is", "are", "that", "this", "these", "those", "by", "as", "at", "from", "be", "was", "were"}
    keywords = [word for word in words if word.lower() not in stop and len(word) > 3][:4]
    return " ".join(keywords).lower() if keywords else "the identified problem"


def compare_papers(papers: list[Any]) -> list[dict[str, Any]]:
    results = []
    for paper in papers:
        # Prefer the real paper title from PDF metadata over the filename-derived DB title
        try:
            meta: dict[str, str] = json.loads(paper.source_metadata or "{}")
        except (ValueError, TypeError):
            meta = {}
        real_title = (meta.get("title") or "").strip() or paper.title

        # Prefer publication year extracted from subject field over upload year
        year: int | None = None
        subject = (meta.get("subject") or "").strip()
        year_match = re.search(r"\b(19|20)\d{2}\b", subject)
        if year_match:
            year = int(year_match.group())
        else:
            date_str = meta.get("creationDate") or meta.get("modDate") or ""
            date_match = re.match(r"D:(\d{4})", date_str)
            if date_match:
                year = int(date_match.group(1))
            else:
                year = paper.created_at.year if paper.created_at else None

        results.append(
            {
                "paper_id": paper.id,
                "title": real_title,
                "year": year,
                "keywords": [kw.strip() for kw in paper.keywords.split(",") if kw.strip()],
                "abstract": paper.abstract,
                "sentence_count": paper.sentence_count,
                "metadata": paper.source_metadata,
            }
        )
    return results


def title_for(gap_type: str) -> str:
    return {
        "limitations": "Documented limitations requiring further study",
        "future_work": "Future work proposed by the source evidence",
        "method_gap": "Methodological gaps and underexplored comparisons",
    }[gap_type]
