"""
Integration and API schema tests using FastAPI TestClient.
"""

from unittest.mock import MagicMock
from fastapi.testclient import TestClient
import pytest

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
            "device": "mps",
            "dimension": 1024,
            "is_loaded": True,
        },
    }
    retriever.retrieve.return_value = [
        {
            "chunk_id": "DOJ_STAT_RULE_LIVESTREAM_R005_R008_R009",
            "score": 0.88,
            "source_document": "model_rules_for_live_streaming.pdf",
            "source_url": "https://cdnbbsr.s3waas.gov.in/test.pdf",
            "page_number_or_range": "5-7",
            "topic": "Live-streaming rules",
            "information_type": "static",
            "publication_date": "2021-06-01",
            "data_as_of": "2021-06-01",
            "fidelity_classification": "verbatim",
            "source_content": "Rule 5: Live streaming shall not be permitted for...",
            "content": "Rule 5: Live streaming shall not be permitted for matrimonial matters...",
            "derived_analysis": None,
            "audit_notes": None,
        }
    ]
    return retriever


def test_root_endpoint():
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "nyaya-sahayak-ai-service"
    assert data["status"] == "operational"


def test_health_endpoint(mock_retriever):
    app.dependency_overrides[get_retriever] = lambda: mock_retriever
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["vector_store"]["total_indexed_chunks"] == 229
    assert data["embedding_model"]["name"] == "BAAI/bge-m3"
    app.dependency_overrides.clear()


def test_retrieve_endpoint(mock_retriever):
    app.dependency_overrides[get_retriever] = lambda: mock_retriever
    client = TestClient(app)
    response = client.post(
        "/api/v1/retrieve",
        json={"query": "live streaming rules", "top_k": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["results"][0]["chunk_id"] == "DOJ_STAT_RULE_LIVESTREAM_R005_R008_R009"
    app.dependency_overrides.clear()


def test_chat_endpoint(mock_retriever):
    app.dependency_overrides[get_retriever] = lambda: mock_retriever
    client = TestClient(app)
    response = client.post(
        "/api/v1/chat",
        json={"message": "What matters cannot be live streamed?", "top_k": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "steps" in data
    assert "portal" in data
    assert "source" in data
    assert "citations" in data
    assert len(data["citations"]) == 1
    assert data["citations"][0]["chunk_id"] == "DOJ_STAT_RULE_LIVESTREAM_R005_R008_R009"
    app.dependency_overrides.clear()
