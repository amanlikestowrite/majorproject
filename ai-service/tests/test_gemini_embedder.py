"""
Unit tests for Google Gemini Hosted Embedding Service (gemini-embedding-001)
"""

import math
from unittest.mock import MagicMock
import pytest
from google.genai import errors, types

from app.config import Settings
from app.services.embedder import (
    EmbeddingService,
    get_embedding_service,
    GeminiEmbeddingService,
    GeminiEmbeddingError,
    GeminiAuthError,
    GeminiQuotaExhaustedError,
    GeminiTimeoutError,
    GeminiDimensionMismatchError,
    GeminiInvalidInputError,
)


def _make_mock_response(values_list):
    """Helper to construct a mock EmbedContentResponse."""
    mock_resp = MagicMock()
    embeddings = []
    for vals in values_list:
        mock_emb = MagicMock()
        mock_emb.values = vals
        embeddings.append(mock_emb)
    mock_resp.embeddings = embeddings
    return mock_resp


def test_gemini_embedder_unconfigured_error():
    """Verify that calling embed without an API key or client raises GeminiAuthError."""
    service = GeminiEmbeddingService(api_key=None, client=None)
    assert service.is_configured is False

    with pytest.raises(GeminiAuthError) as exc_info:
        service.embed_documents(["What is eFiling?"])

    assert "Gemini API key is not configured" in str(exc_info.value)

    with pytest.raises(GeminiAuthError):
        service.embed_query("What is eFiling?")


def test_gemini_embedder_empty_query_returns_zero_vector():
    """Empty or whitespace query returns zero vector without calling API."""
    mock_client = MagicMock()
    service = GeminiEmbeddingService(
        api_key="mock_key",
        expected_dim=768,
        client=mock_client,
    )

    zero_vec = service.embed_query("   ")
    assert len(zero_vec) == 768
    assert all(x == 0.0 for x in zero_vec)
    mock_client.models.embed_content.assert_not_called()


def test_gemini_embedder_embed_query_success_768():
    """Verify 768-dim query embedding applies task_type=RETRIEVAL_QUERY and L2 normalization."""
    mock_client = MagicMock()
    # Unnormalized 768-dim slice with non-unit norm
    raw_vec = [0.05] * 768
    mock_client.models.embed_content.return_value = _make_mock_response([raw_vec])

    service = GeminiEmbeddingService(
        api_key="mock_key",
        expected_dim=768,
        client=mock_client,
        normalize=True,
    )

    vec = service.embed_query("How to pay traffic challans online?")
    assert len(vec) == 768

    # Verify call parameters
    mock_client.models.embed_content.assert_called_once()
    call_kwargs = mock_client.models.embed_content.call_args[1]
    assert call_kwargs["model"] == "gemini-embedding-001"
    assert call_kwargs["contents"] == "How to pay traffic challans online?"
    assert call_kwargs["config"].task_type == "RETRIEVAL_QUERY"
    assert call_kwargs["config"].output_dimensionality == 768

    # Verify L2 unit norm
    norm = math.sqrt(sum(x * x for x in vec))
    assert math.isclose(norm, 1.0, abs_tol=1e-5)


def test_gemini_embedder_embed_query_success_3072():
    """Verify 3072-dim query embedding with full output dimension."""
    mock_client = MagicMock()
    raw_vec = [0.01] * 3072
    mock_client.models.embed_content.return_value = _make_mock_response([raw_vec])

    service = GeminiEmbeddingService(
        api_key="mock_key",
        expected_dim=3072,
        client=mock_client,
        normalize=True,
    )

    vec = service.embed_query("Supreme Court judge strength")
    assert len(vec) == 3072

    call_kwargs = mock_client.models.embed_content.call_args[1]
    assert call_kwargs["config"].output_dimensionality == 3072


def test_gemini_embedder_embed_documents_batch_success():
    """Verify batch document embeddings apply task_type=RETRIEVAL_DOCUMENT and normalization."""
    mock_client = MagicMock()
    raw_vecs = [[0.03] * 768, [-0.04] * 768]
    mock_client.models.embed_content.return_value = _make_mock_response(raw_vecs)

    service = GeminiEmbeddingService(
        api_key="mock_key",
        expected_dim=768,
        client=mock_client,
        batch_size=2,
        normalize=True,
    )

    docs = ["Document chunk 1", "Document chunk 2"]
    results = service.embed_documents(docs)

    assert len(results) == 2
    for vec in results:
        assert len(vec) == 768
        norm = math.sqrt(sum(x * x for x in vec))
        assert math.isclose(norm, 1.0, abs_tol=1e-5)

    call_kwargs = mock_client.models.embed_content.call_args[1]
    assert call_kwargs["config"].task_type == "RETRIEVAL_DOCUMENT"
    assert call_kwargs["contents"] == docs


def test_gemini_embedder_empty_documents_returns_empty_list():
    """Empty list returns immediately without invoking API."""
    mock_client = MagicMock()
    service = GeminiEmbeddingService(api_key="mock_key", client=mock_client)
    res = service.embed_documents([])
    assert res == []
    mock_client.models.embed_content.assert_not_called()


def test_gemini_embedder_quota_exhausted_raises_exception():
    """HTTP 429 or RESOURCE_EXHAUSTED raises GeminiQuotaExhaustedError."""
    mock_client = MagicMock()
    mock_client.models.embed_content.side_effect = errors.APIError(
        code=429,
        response_json={"error": {"code": 429, "message": "Resource exhausted / quota limit"}},
    )

    service = GeminiEmbeddingService(api_key="mock_key", client=mock_client)

    with pytest.raises(GeminiQuotaExhaustedError) as exc_info:
        service.embed_query("Test query")

    assert "rate limit or quota exceeded" in str(exc_info.value).lower()


def test_gemini_embedder_timeout_raises_exception():
    """Timeout error raises GeminiTimeoutError."""
    mock_client = MagicMock()
    mock_client.models.embed_content.side_effect = TimeoutError("Request timed out after 30s")

    service = GeminiEmbeddingService(api_key="mock_key", client=mock_client)

    with pytest.raises(GeminiTimeoutError) as exc_info:
        service.embed_query("Test query")

    assert "timed out" in str(exc_info.value).lower()


def test_gemini_embedder_dimension_mismatch_raises_exception():
    """Mismatch between expected_dim and returned vector raises GeminiDimensionMismatchError."""
    mock_client = MagicMock()
    # Return 512 dimensions when 768 expected
    mock_client.models.embed_content.return_value = _make_mock_response([[0.1] * 512])

    service = GeminiEmbeddingService(
        api_key="mock_key",
        expected_dim=768,
        client=mock_client,
    )

    with pytest.raises(GeminiDimensionMismatchError) as exc_info:
        service.embed_query("Test query")

    assert "Dimension mismatch" in str(exc_info.value)


def test_gemini_embedder_invalid_nan_values_raises_exception():
    """Non-finite float values (NaN) raise GeminiInvalidInputError."""
    mock_client = MagicMock()
    bad_vec = [0.1] * 767 + [float("nan")]
    mock_client.models.embed_content.return_value = _make_mock_response([bad_vec])

    service = GeminiEmbeddingService(
        api_key="mock_key",
        expected_dim=768,
        client=mock_client,
    )

    with pytest.raises(GeminiInvalidInputError) as exc_info:
        service.embed_query("Test query")

    assert "non-finite" in str(exc_info.value).lower()


def test_get_embedding_service_factory_gemini():
    """Factory returns GeminiEmbeddingService when EMBEDDING_PROVIDER=gemini."""
    settings = Settings(
        embedding_provider="gemini",
        gemini_api_key="test_key_gemini",
        gemini_embedding_model="gemini-embedding-001",
        gemini_embedding_dimension=768,
    )
    svc = get_embedding_service(settings)
    assert isinstance(svc, GeminiEmbeddingService)
    assert svc.model_name == "gemini-embedding-001"
    assert svc.expected_dim == 768


def test_gemini_embedder_get_info():
    """Diagnostic get_info returns expected structure."""
    service = GeminiEmbeddingService(
        api_key="mock_key",
        model_name="gemini-embedding-001",
        expected_dim=768,
        batch_size=16,
        normalize=True,
    )
    info = service.get_info()
    assert info["provider"] == "gemini"
    assert info["model_name"] == "gemini-embedding-001"
    assert info["dimension"] == 768
    assert info["task_types"]["query"] == "RETRIEVAL_QUERY"
    assert info["task_types"]["document"] == "RETRIEVAL_DOCUMENT"
    assert info["batch_size"] == 16
    assert info["normalized"] is True
    assert info["is_configured"] is True

