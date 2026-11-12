"""
Nyaya Sahayak — Comprehensive API Test Suite
Covers /api/v1/health, /api/v1/retrieve, and /api/v1/chat endpoints.
"""

import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.health import get_retriever
from app.services.retriever import KnowledgeRetriever


@pytest.fixture
def mock_retriever():
    retriever = MagicMock(spec=KnowledgeRetriever)
    retriever.get_health.return_value = {
        "vector_store": {
            "engine": "qdrant",
            "mode": "embedded",
            "collection": "doj_knowledge_base",
            "total_indexed_chunks": 229,
            "status": "ready",
        },
        "embedding_model": {
            "name": "BAAI/bge-m3",
            "device": "cpu",
            "dimension": 1024,
            "is_loaded": True,
        },
    }
    retriever.retrieve.return_value = [
        {
            "chunk_id": "DOJ_STAT_PROC_EFILING_REGISTRATION",
            "score": 0.91,
            "source_document": "efiling_3_0_user_manual.pdf",
            "source_url": "https://efiling.ecourts.gov.in/manual",
            "page_number_or_range": "12-14",
            "topic": "eCourts, eFiling, ePay, and case status",
            "information_type": "static",
            "publication_date": "2023-01-15",
            "data_as_of": "2023-01-15",
            "fidelity_classification": "verbatim",
            "source_content": "Advocates and litigants must register using verified mobile number and Bar Council registration...",
            "content": "Advocates and litigants must register using verified mobile number and Bar Council registration...",
            "derived_analysis": None,
            "audit_notes": None,
        }
    ]
    return retriever


class TestHealthEndpoint:
    """Tests for GET /api/v1/health."""

    def test_health_success(self, mock_retriever):
        app.dependency_overrides[get_retriever] = lambda: mock_retriever
        client = TestClient(app)
        response = client.get("/api/v1/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "nyaya-sahayak-ai-service"
        assert data["vector_store"]["status"] == "ready"
        assert data["vector_store"]["total_indexed_chunks"] == 229
        assert data["embedding_model"]["name"] == "BAAI/bge-m3"
        app.dependency_overrides.clear()


class TestRetrieveEndpoint:
    """Tests for POST /api/v1/retrieve."""

    def test_retrieve_success(self, mock_retriever):
        app.dependency_overrides[get_retriever] = lambda: mock_retriever
        client = TestClient(app)
        response = client.post(
            "/api/v1/retrieve",
            json={
                "query": "How do I register for eFiling 3.0?",
                "top_k": 3,
                "topic": "eCourts, eFiling, ePay, and case status",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "How do I register for eFiling 3.0?"
        assert data["total"] == 1
        assert len(data["results"]) == 1
        assert data["results"][0]["chunk_id"] == "DOJ_STAT_PROC_EFILING_REGISTRATION"
        assert data["results"][0]["source_document"] == "efiling_3_0_user_manual.pdf"
        assert data["results"][0]["fidelity_classification"] == "verbatim"
        app.dependency_overrides.clear()

    def test_retrieve_validation_empty_query(self):
        client = TestClient(app)
        response = client.post("/api/v1/retrieve", json={"query": ""})
        assert response.status_code == 422

    def test_retrieve_validation_top_k_bounds(self):
        client = TestClient(app)
        # top_k must be between 1 and 20
        response = client.post("/api/v1/retrieve", json={"query": "Valid query", "top_k": 50})
        assert response.status_code == 422


class TestChatEndpoint:
    """Tests for POST /api/v1/chat."""

    def test_chat_success_english(self, mock_retriever):
        app.dependency_overrides[get_retriever] = lambda: mock_retriever
        client = TestClient(app)
        response = client.post(
            "/api/v1/chat",
            json={
                "message": "How do I register on the eFiling portal?",
                "userId": "usr_test_001",
                "conversationId": "conv_test_001",
                "language": "en",
                "top_k": 2,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["userId"] == "usr_test_001"
        assert data["conversationId"] == "conv_test_001"
        assert "summary" in data
        assert "steps" in data
        assert isinstance(data["steps"], list)
        assert data["portal"]["domain"] == "efiling.ecourts.gov.in"
        assert len(data["citations"]) == 1
        assert data["citations"][0]["chunk_id"] == "DOJ_STAT_PROC_EFILING_REGISTRATION"
        app.dependency_overrides.clear()

    def test_chat_success_hindi(self, mock_retriever):
        app.dependency_overrides[get_retriever] = lambda: mock_retriever
        client = TestClient(app)
        response = client.post(
            "/api/v1/chat",
            json={
                "message": "ई-फाइलिंग पोर्टल पर पंजीकरण कैसे करें?",
                "language": "hi",
                "top_k": 1,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert data["portal"] is not None
        assert len(data["citations"]) == 1
        app.dependency_overrides.clear()

    def test_chat_empty_retrieval_abstention(self):
        empty_retriever = MagicMock(spec=KnowledgeRetriever)
        empty_retriever.retrieve.return_value = []
        app.dependency_overrides[get_retriever] = lambda: empty_retriever

        client = TestClient(app)
        response = client.post(
            "/api/v1/chat",
            json={"message": "Unrelated question about foreign court filing"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "No matching official record was located" in data["summary"]
        assert len(data["citations"]) == 0
        assert data["portal"]["domain"] == "doj.gov.in"
        assert "administrative and procedural guidance" in data["important"]
        app.dependency_overrides.clear()

    def test_chat_validation_empty_message(self):
        client = TestClient(app)
        response = client.post("/api/v1/chat", json={"message": ""})
        assert response.status_code == 422
