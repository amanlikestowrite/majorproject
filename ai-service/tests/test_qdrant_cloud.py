"""
Unit tests for Qdrant Cloud integration, dimension safety, and operational failure modes.
"""

from unittest.mock import MagicMock, patch
import pytest
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.exceptions import ResponseHandlingException, UnexpectedResponse

from app.config import Settings
from app.services.vector_store import QdrantVectorStore


def test_qdrant_cloud_initialization_with_credentials():
    """Verify QdrantVectorStore correctly sets up cloud mode when URL and API key are configured."""
    mock_client = MagicMock(spec=QdrantClient)
    # Mock collection check
    mock_coll = MagicMock()
    mock_coll.name = "doj_gemini_768"
    mock_client.get_collections.return_value = MagicMock(collections=[mock_coll])

    settings = Settings(
        qdrant_url="https://mock-cluster.cloud.qdrant.io:6333",
        qdrant_api_key="mock_cloud_key",
        qdrant_collection_name="doj_gemini_768",
        embedding_dimension=768,
    )

    store = QdrantVectorStore(settings=settings, client=mock_client)
    assert store.is_cloud is True
    assert store.collection_name == "doj_gemini_768"
    assert store.vector_dim == 768


def test_qdrant_dimension_mismatch_prevents_silent_fallback():
    """Ensure sending a 768-dim vector to a 1024-dim collection raises ValueError explicitly."""
    mock_client = MagicMock(spec=QdrantClient)
    mock_coll = MagicMock()
    mock_coll.name = "doj_knowledge_base"
    mock_client.get_collections.return_value = MagicMock(collections=[mock_coll])

    settings = Settings(
        qdrant_collection_name="doj_knowledge_base",
        embedding_dimension=1024,
    )

    store = QdrantVectorStore(settings=settings, client=mock_client)

    # 768-dim query vector passed to 1024-dim collection
    wrong_dim_query = [0.01] * 768

    with pytest.raises(ValueError) as exc_info:
        store.search(wrong_dim_query, top_k=5)

    assert "Query vector dimension mismatch" in str(exc_info.value)
    assert "query has 768 dimensions" in str(exc_info.value)
    assert "requires 1024 dimensions" in str(exc_info.value)
    # Ensure no query was dispatched to the vector database
    mock_client.query_points.assert_not_called()


def test_qdrant_cloud_unavailability_handling():
    """Verify Qdrant connection timeout or network unavailability raises appropriate error."""
    mock_client = MagicMock(spec=QdrantClient)
    mock_coll = MagicMock()
    mock_coll.name = "doj_gemini_768"
    mock_client.get_collections.return_value = MagicMock(collections=[mock_coll])
    mock_client.query_points.side_effect = ResponseHandlingException("Connection refused / timed out")

    settings = Settings(
        qdrant_url="https://mock-cluster.cloud.qdrant.io:6333",
        qdrant_api_key="mock_cloud_key",
        qdrant_collection_name="doj_gemini_768",
        embedding_dimension=768,
    )

    store = QdrantVectorStore(settings=settings, client=mock_client)

    with pytest.raises(ResponseHandlingException) as exc_info:
        store.search([0.01] * 768, top_k=3)

    assert "Connection refused" in str(exc_info.value)


def test_qdrant_cloud_invalid_credentials_handling():
    """Verify HTTP 401/403 unauthorized error from Qdrant Cloud."""
    mock_client = MagicMock(spec=QdrantClient)
    mock_coll = MagicMock()
    mock_coll.name = "doj_gemini_768"
    mock_client.get_collections.return_value = MagicMock(collections=[mock_coll])
    mock_client.query_points.side_effect = UnexpectedResponse(
        status_code=401,
        reason_phrase="Unauthorized",
        content=b"Invalid API Key",
        headers={},
    )

    settings = Settings(
        qdrant_url="https://mock-cluster.cloud.qdrant.io:6333",
        qdrant_api_key="invalid_key",
        qdrant_collection_name="doj_gemini_768",
        embedding_dimension=768,
    )

    store = QdrantVectorStore(settings=settings, client=mock_client)

    with pytest.raises(UnexpectedResponse) as exc_info:
        store.search([0.01] * 768, top_k=3)

    assert exc_info.value.status_code == 401


def test_qdrant_empty_search_results():
    """Verify empty search results return an empty list gracefully."""
    mock_client = MagicMock(spec=QdrantClient)
    mock_coll = MagicMock()
    mock_coll.name = "doj_gemini_768"
    mock_client.get_collections.return_value = MagicMock(collections=[mock_coll])
    mock_client.query_points.return_value = MagicMock(points=[])

    settings = Settings(
        qdrant_collection_name="doj_gemini_768",
        embedding_dimension=768,
    )

    store = QdrantVectorStore(settings=settings, client=mock_client)
    res = store.search([0.01] * 768, top_k=3)
    assert res == []


def test_qdrant_cloud_get_stats_formatting():
    """Verify get_stats displays cloud mode and does not leak API keys."""
    mock_client = MagicMock(spec=QdrantClient)
    mock_coll = MagicMock()
    mock_coll.name = "doj_gemini_768"
    mock_client.get_collections.return_value = MagicMock(collections=[mock_coll])

    info_mock = MagicMock()
    info_mock.points_count = 229
    info_mock.status = "green"
    mock_client.get_collection.return_value = info_mock

    settings = Settings(
        qdrant_url="https://xyz-cluster.cloud.qdrant.io:6333",
        qdrant_api_key="super_secret_api_key",
        qdrant_collection_name="doj_gemini_768",
        embedding_dimension=768,
    )

    store = QdrantVectorStore(settings=settings, client=mock_client)
    stats = store.get_stats()

    assert stats["mode"] == "cloud"
    assert stats["collection"] == "doj_gemini_768"
    assert stats["total_indexed_chunks"] == 229
    assert stats["vector_dimension"] == 768
    # Ensure api key is never in stats
    assert "super_secret_api_key" not in str(stats)
