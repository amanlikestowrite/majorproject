"""
Unit tests for Startup Configuration & Infrastructure Validator (Phase 4D)
"""

from unittest.mock import MagicMock
import pytest
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import Settings
from app.services.startup_validator import (
    ConfigurationValidationError,
    validate_startup_configuration,
)


def _make_mock_client(collection_name="doj_gemini_768", vector_size=768, points_count=229, distance=qmodels.Distance.COSINE):
    """Helper to create a fully configured mock QdrantClient."""
    mock_client = MagicMock(spec=QdrantClient)
    mock_coll = MagicMock()
    mock_coll.name = collection_name
    mock_client.get_collections.return_value = MagicMock(collections=[mock_coll])

    info_mock = MagicMock()
    info_mock.config.params.vectors.size = vector_size
    info_mock.config.params.vectors.distance = distance
    info_mock.points_count = points_count
    mock_client.get_collection.return_value = info_mock
    return mock_client


def test_validate_startup_local_configuration_success():
    """Verify local development configuration passes validation."""
    mock_client = _make_mock_client(
        collection_name="doj_knowledge_base",
        vector_size=1024,
        points_count=229,
        distance=qmodels.Distance.COSINE,
    )
    settings = Settings(
        embedding_provider="local",
        vector_store_mode="embedded",
        qdrant_collection_name="doj_knowledge_base",
        embedding_dimension=1024,
    )
    result = validate_startup_configuration(settings, qdrant_client=mock_client)
    assert result["status"] == "valid"
    assert result["provider"] == "local"
    assert result["vector_store_mode"] == "embedded"
    assert result["collection"] == "doj_knowledge_base"
    assert result["dimension"] == 1024
    assert result["points_count"] == 229


def test_validate_startup_cloud_configuration_success():
    """Verify cloud deployment configuration passes validation."""
    mock_client = _make_mock_client(
        collection_name="doj_gemini_768",
        vector_size=768,
        points_count=229,
        distance=qmodels.Distance.COSINE,
    )
    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="valid_mock_key",
        gemini_embedding_model="gemini-embedding-001",
        gemini_embedding_dimension=768,
        vector_store_mode="cloud",
        qdrant_url="https://mock-cluster.cloud.qdrant.io:6333",
        qdrant_api_key="valid_cloud_key",
        qdrant_collection_name="doj_gemini_768",
    )
    result = validate_startup_configuration(settings, qdrant_client=mock_client)
    assert result["status"] == "valid"
    assert result["provider"] == "gemini"
    assert result["vector_store_mode"] == "cloud"
    assert result["collection"] == "doj_gemini_768"
    assert result["dimension"] == 768


def test_validate_startup_invalid_provider_raises_error():
    """Unsupported provider fails immediately."""
    settings = Settings()
    object.__setattr__(settings, "embedding_provider", "invalid_provider")
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings)
    assert "Invalid EMBEDDING_PROVIDER" in str(exc.value)


def test_validate_startup_missing_gemini_api_key_raises_error():
    """Gemini provider without an API key fails startup validation."""
    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key=None,
    )
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings)
    assert "GEMINI_API_KEY is not configured" in str(exc.value)


def test_validate_startup_missing_cloud_url_raises_error():
    """Cloud mode without QDRANT_URL fails startup validation."""
    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="mock_key",
        vector_store_mode="cloud",
        qdrant_url=None,
        qdrant_api_key="mock_key",
    )
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings)
    assert "QDRANT_URL is not configured" in str(exc.value)


def test_validate_startup_missing_cloud_api_key_raises_error():
    """Cloud mode without QDRANT_API_KEY fails startup validation."""
    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="mock_key",
        vector_store_mode="cloud",
        qdrant_url="https://cluster.qdrant.io:6333",
        qdrant_api_key=None,
    )
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings)
    assert "QDRANT_API_KEY is not configured" in str(exc.value)


def test_validate_startup_missing_qdrant_collection_raises_error():
    """Missing target collection fails startup validation without auto-recreating."""
    mock_client = MagicMock(spec=QdrantClient)
    # Available collections does NOT contain doj_gemini_768
    other_coll = MagicMock()
    other_coll.name = "other_collection"
    mock_client.get_collections.return_value = MagicMock(collections=[other_coll])

    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="mock_key",
        vector_store_mode="cloud",
        qdrant_url="https://cluster.qdrant.io:6333",
        qdrant_api_key="mock_key",
        qdrant_collection_name="doj_gemini_768",
        gemini_embedding_dimension=768,
    )
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings, qdrant_client=mock_client)

    assert "Target collection 'doj_gemini_768' does not exist" in str(exc.value)
    assert "auto-creation is disabled" in str(exc.value)


def test_validate_startup_dimension_mismatch_raises_error():
    """Active provider dimension mismatch with collection is rejected."""
    # Collection has 1024 dims, but Gemini provider expects 768 dims
    mock_client = _make_mock_client(
        collection_name="doj_knowledge_base",
        vector_size=1024,
        points_count=229,
    )
    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="mock_key",
        vector_store_mode="cloud",
        qdrant_url="https://cluster.qdrant.io:6333",
        qdrant_api_key="mock_key",
        qdrant_collection_name="doj_knowledge_base",
        gemini_embedding_dimension=768,
    )
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings, qdrant_client=mock_client)

    assert "Dimension Mismatch" in str(exc.value)
    assert "outputs 768 dimensions" in str(exc.value)
    assert "configured for 1024 dimensions" in str(exc.value)


def test_validate_startup_cloud_connection_failure_raises_error():
    """Network connection failure raises clear error without crashing unhandled."""
    mock_client = MagicMock(spec=QdrantClient)
    mock_client.get_collections.side_effect = ConnectionError("Could not resolve host cluster.qdrant.io")

    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="mock_key",
        vector_store_mode="cloud",
        qdrant_url="https://cluster.qdrant.io:6333",
        qdrant_api_key="mock_key",
        qdrant_collection_name="doj_gemini_768",
    )
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings, qdrant_client=mock_client)

    assert "Could not connect to Qdrant" in str(exc.value)


def test_validate_startup_distance_mismatch_raises_error():
    """Collection with non-Cosine metric (e.g. Euclidean / Dot) is rejected."""
    mock_client = _make_mock_client(
        collection_name="doj_gemini_768",
        vector_size=768,
        points_count=229,
        distance=qmodels.Distance.DOT,
    )
    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="mock_key",
        vector_store_mode="cloud",
        qdrant_url="https://cluster.qdrant.io:6333",
        qdrant_api_key="mock_key",
        qdrant_collection_name="doj_gemini_768",
        gemini_embedding_dimension=768,
    )
    with pytest.raises(ConfigurationValidationError) as exc:
        validate_startup_configuration(settings, qdrant_client=mock_client)

    assert "Distance Metric Mismatch" in str(exc.value)
