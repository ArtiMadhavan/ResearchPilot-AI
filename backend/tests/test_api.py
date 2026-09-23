from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_chat_rejects_empty_question():
    response = client.post("/api/chat", json={"question": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "question must not be empty"


def test_chat_rejects_invalid_top_k_before_model_loading():
    response = client.post("/api/chat", json={"question": "What is this?", "top_k": 21})
    assert response.status_code == 400
    assert response.json()["detail"] == "top_k must be between 1 and 20"


def test_search_rejects_invalid_top_k():
    response = client.get("/api/search", params={"q": "research", "top_k": 0})
    assert response.status_code == 400
    assert response.json()["detail"] == "top_k must be between 1 and 20"
