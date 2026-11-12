"""
Unit tests for Internal Service Authentication (Phase 4E)
"""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


@pytest.fixture(autouse=True)
def cleanup_overrides():
    """Ensure dependency overrides are cleaned up after each test."""
    yield
    app.dependency_overrides.clear()


def test_public_endpoints_accessible_without_auth():
    """Health and root endpoints must remain publicly accessible without auth tokens."""
    client = TestClient(app)
    health_resp = client.get("/api/v1/health")
    assert health_resp.status_code == 200

    root_resp = client.get("/")
    assert root_resp.status_code == 200


def test_protected_endpoints_allow_when_token_unset():
    """When internal_service_token is None/empty (local dev default), requests are permitted."""
    app.dependency_overrides[get_settings] = lambda: Settings(internal_service_token=None)
    client = TestClient(app)

    with patch("app.services.retriever.KnowledgeRetriever.retrieve", return_value=[]):
        resp = client.post("/api/v1/retrieve", json={"query": "test query", "top_k": 2})
        assert resp.status_code == 200


def test_protected_endpoints_reject_missing_token():
    """When internal_service_token is configured, requests without token receive 401."""
    app.dependency_overrides[get_settings] = lambda: Settings(internal_service_token="test_secret_token_123")
    client = TestClient(app)

    resp = client.post("/api/v1/retrieve", json={"query": "test query", "top_k": 2})
    assert resp.status_code == 401
    assert "Invalid or missing internal service token" in resp.json()["detail"]


def test_protected_endpoints_reject_invalid_token():
    """When internal_service_token is configured, requests with wrong token receive 401."""
    app.dependency_overrides[get_settings] = lambda: Settings(internal_service_token="test_secret_token_123")
    client = TestClient(app)

    # Wrong header key
    resp1 = client.post(
        "/api/v1/retrieve",
        headers={"X-Internal-Service-Key": "wrong_key"},
        json={"query": "test query", "top_k": 2},
    )
    assert resp1.status_code == 401

    # Wrong bearer token
    resp2 = client.post(
        "/api/v1/retrieve",
        headers={"Authorization": "Bearer wrong_token"},
        json={"query": "test query", "top_k": 2},
    )
    assert resp2.status_code == 401


def test_protected_endpoints_accept_valid_internal_service_key_header():
    """Valid X-Internal-Service-Key header grants access."""
    app.dependency_overrides[get_settings] = lambda: Settings(internal_service_token="test_secret_token_123")
    client = TestClient(app)

    with patch("app.services.retriever.KnowledgeRetriever.retrieve", return_value=[]):
        resp = client.post(
            "/api/v1/retrieve",
            headers={"X-Internal-Service-Key": "test_secret_token_123"},
            json={"query": "test query", "top_k": 2},
        )
        assert resp.status_code == 200


def test_protected_endpoints_accept_valid_internal_secret_header_fallback():
    """Fallback X-Internal-Secret header also grants access."""
    app.dependency_overrides[get_settings] = lambda: Settings(internal_service_token="test_secret_token_123")
    client = TestClient(app)

    with patch("app.services.retriever.KnowledgeRetriever.retrieve", return_value=[]):
        resp = client.post(
            "/api/v1/retrieve",
            headers={"X-Internal-Secret": "test_secret_token_123"},
            json={"query": "test query", "top_k": 2},
        )
        assert resp.status_code == 200


def test_protected_endpoints_accept_valid_bearer_token():
    """Valid Authorization Bearer token grants access."""
    app.dependency_overrides[get_settings] = lambda: Settings(internal_service_token="test_secret_token_123")
    client = TestClient(app)

    with patch("app.services.retriever.KnowledgeRetriever.retrieve", return_value=[]):
        resp = client.post(
            "/api/v1/retrieve",
            headers={"Authorization": "Bearer test_secret_token_123"},
            json={"query": "test query", "top_k": 2},
        )
        assert resp.status_code == 200

