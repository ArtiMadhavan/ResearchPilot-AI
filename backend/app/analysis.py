import re
import os
from typing import Any

import fitz
from sklearn.feature_extraction.text import TfidfVectorizer


def segment_sentences(text: str) -> list[str]:
    if os.getenv("ENABLE_SPACY", "0") == "1":
        import spacy

        nlp = spacy.blank("en")
        nlp.add_pipe("sentencizer")
        return [sentence.text.strip() for sentence in nlp(text).sents if sentence.text.strip()]
    return [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text) if sentence.strip()]


def extract_pdf(content: bytes) -> tuple[str, dict[str, str]]:
    try:
        document = fitz.open(stream=content, filetype="pdf")
    except Exception as error:
        raise ValueError("The uploaded file is not a readable PDF") from error

    text = "\n".join(page.get_text() for page in document).strip()
    if not text:
        raise ValueError("The PDF did not contain extractable text")
    metadata = {
        key: str(value).strip()
        for key, value in (document.metadata or {}).items()
        if value and str(value).strip()
    }
    return text, metadata


def extract_pdf_text(content: bytes) -> str:
    return extract_pdf(content)[0]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def analyze_text(text: str) -> dict[str, Any]:
    normalized = normalize_text(text)
    sentences = segment_sentences(normalized)
    abstract = " ".join(sentences[:3])[:1200]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=12, ngram_range=(1, 2))
    matrix = vectorizer.fit_transform([normalized])
    scores = matrix.toarray()[0]
    terms = vectorizer.get_feature_names_out()
    keywords = [term for _, term in sorted(zip(scores, terms), reverse=True)[:8]]
    return {
        "abstract": abstract,
        "keywords": keywords,
        "sentence_count": len(sentences),
        "character_count": len(normalized),
    }
