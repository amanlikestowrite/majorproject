"""
Unit tests for Hosted BGE-M3 Embedding Service
"""

import math
from unittest.mock import MagicMock, patch
import httpx
import pytest

from app.config import Settings
from app.services.embedder import (
    EmbeddingService,
    get_embedding_service,
    HostedBgeM3EmbeddingService,
    HostedEmbeddingError,
    HostedAuthError,
    HostedModelLoadingError,
    HostedQuotaExhaustedError,
    HostedPaymentRequiredError,
    HostedTimeoutError,
    HostedDimensionMismatchError,
)
from app.services.retriever import KnowledgeRetriever


def test_hosted_embedder_unconfigured_error():
    """Verify that calling embed without an HF token raises HostedAuthError."""
    service = HostedBgeM3EmbeddingService(token=None)
    assert service.is_configured is False

    with pytest.raises(HostedAuthError) as exc_info:
        service.embed_documents(["What is eFiling?"])

    assert "Hugging Face API token is not configured" in str(exc_info.value)


def test_hosted_embedder_empty_query_returns_zero_vector():
    """Empty or whitespace query returns a 1024-dim zero vector without calling API."""
    mock_client = MagicMock(spec=httpx.Client)
    service = HostedBgeM3EmbeddingService(token="hf_mock_token", client=mock_client)

    zero_vec = service.embed_query("   ")
    assert len(zero_vec) == 1024
    assert all(x == 0.0 for x in zero_vec)
    # Ensure no network call was made
    mock_client.post.assert_not_called()


def test_hosted_embedder_embed_query_success_1d():
    """Verify 1D float list from TEI endpoint is parsed, validated, and normalized."""
    raw_vec = [0.05] * 1024
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = raw_vec

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_resp

    service = HostedBgeM3EmbeddingService(
        token="hf_mock_token_secret_12345",
        client=mock_client,
        normalize=True,
    )

    vec = service.embed_query("What matters cannot be live-streamed?")
    assert len(vec) == 1024
    # Check L2 unit-norm
    norm = math.sqrt(sum(x * x for x in vec))
    assert math.isclose(norm, 1.0, abs_tol=1e-5)


def test_hosted_embedder_embed_documents_batch_success_2d():
    """Verify 2D batch responses are correctly parsed and normalized."""
    raw_batch = [[0.02] * 1024, [-0.03] * 1024]
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = raw_batch

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_resp

    service = HostedBgeM3EmbeddingService(token="hf_mock", client=mock_client)

    results = service.embed_documents(["Query 1", "Query 2"])
    assert len(results) == 2
    for vec in results:
        assert len(vec) == 1024
        norm = math.sqrt(sum(x * x for x in vec))
        assert math.isclose(norm, 1.0, abs_tol=1e-5)


def test_hosted_embedder_3d_token_pooling_cls():
    """Verify 3D token representations extract index 0 (CLS token) and normalize."""
    # [batch_size=1, seq_len=3, dim=1024]
    cls_token = [0.1] * 1024
    other_token = [0.9] * 1024
    raw_3d = [[cls_token, other_token, other_token]]

    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = raw_3d

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_resp

    service = HostedBgeM3EmbeddingService(token="hf_mock", client=mock_client)

    results = service.embed_documents(["Sample text"])
    assert len(results) == 1
    vec = results[0]
    assert len(vec) == 1024
    norm = math.sqrt(sum(x * x for x in vec))
    assert math.isclose(norm, 1.0, abs_tol=1e-5)


def test_hosted_embedder_auth_failure_401():
    """Verify HTTP 401 raises HostedAuthError without exposing token."""
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 401
    mock_resp.text = "Unauthorized"

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_resp

    secret_token = "hf_super_secret_key_999"
    service = HostedBgeM3EmbeddingService(token=secret_token, client=mock_client)

    with pytest.raises(HostedAuthError) as exc_info:
        service.embed_query("test query")

    assert "authentication failed" in str(exc_info.value)
    assert secret_token not in str(exc_info.value)


def test_hosted_embedder_rate_limit_429():
    """Verify HTTP 429 raises HostedQuotaExhaustedError."""
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 429
    mock_resp.text = "Too Many Requests"

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_resp

    service = HostedBgeM3EmbeddingService(token="hf_mock", client=mock_client)

    with pytest.raises(HostedQuotaExhaustedError):
        service.embed_query("test query")


def test_hosted_embedder_payment_required_402():
    """Verify HTTP 402 raises HostedPaymentRequiredError without exposing token."""
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 402
    mock_resp.text = '{"error":"Purchase pre-paid credits to continue using Inference Providers."}'

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_resp

    service = HostedBgeM3EmbeddingService(token="hf_secret_123", client=mock_client)

    with pytest.raises(HostedPaymentRequiredError) as exc_info:
        service.embed_query("test query")

    assert "requires pre-paid credits" in str(exc_info.value)
    assert "hf_secret_123" not in str(exc_info.value)


def test_hosted_embedder_model_loading_503_retry():
    """Verify HTTP 503 triggers retry and succeeds when model finishes loading."""
    mock_resp_503 = MagicMock(spec=httpx.Response)
    mock_resp_503.status_code = 503
    mock_resp_503.json.return_value = {"error": "Model is loading", "estimated_time": 0.01}

    mock_resp_200 = MagicMock(spec=httpx.Response)
    mock_resp_200.status_code = 200
    mock_resp_200.json.return_value = [[0.05] * 1024]

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.side_effect = [mock_resp_503, mock_resp_200]

    service = HostedBgeM3EmbeddingService(
        token="hf_mock",
        client=mock_client,
        max_retries=2,
        retry_delay_seconds=0.01,
    )

    vec = service.embed_query("test query")
    assert len(vec) == 1024
    assert mock_client.post.call_count == 2


def test_hosted_embedder_dimension_mismatch_fails_explicitly():
    """Verify that if the endpoint returns an incompatible dimension (e.g. 768), it fails explicitly."""
    # Model returned 768 dimensions instead of 1024
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = [[0.01] * 768]

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_resp

    service = HostedBgeM3EmbeddingService(token="hf_mock", client=mock_client)

    with pytest.raises(HostedDimensionMismatchError) as exc_info:
        service.embed_query("test query")

    assert "768" in str(exc_info.value)
    assert "1024" in str(exc_info.value)


def test_hosted_embedder_timeout():
    """Verify httpx.TimeoutException is mapped to HostedTimeoutError."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.side_effect = httpx.ReadTimeout("Request timed out")

    service = HostedBgeM3EmbeddingService(
        token="hf_mock",
        client=mock_client,
        max_retries=1,
        retry_delay_seconds=0.01,
    )

    with pytest.raises(HostedTimeoutError):
        service.embed_query("test query")


def test_get_embedding_service_factory():
    """Verify factory returns appropriate service instance based on embedding_provider setting."""
    local_settings = Settings(embedding_provider="local")
    local_svc = get_embedding_service(local_settings)
    assert isinstance(local_svc, EmbeddingService)
    assert local_svc.get_info()["provider"] == "local"

    hf_settings = Settings(embedding_provider="huggingface", hf_token="hf_test_123")
    hf_svc = get_embedding_service(hf_settings)
    assert isinstance(hf_svc, HostedBgeM3EmbeddingService)
    assert hf_svc.get_info()["provider"] == "huggingface"
    assert hf_svc.get_info()["is_configured"] is True


def test_retriever_integration_with_hosted_embedder():
    """Verify KnowledgeRetriever functions seamlessly when injected with hosted embedder."""
    mock_embedder = MagicMock(spec=HostedBgeM3EmbeddingService)
    mock_embedder.embed_query.return_value = [0.01] * 1024
    mock_embedder.get_info.return_value = {"provider": "huggingface", "model_name": "BAAI/bge-m3"}

    mock_vs = MagicMock()
    mock_vs.search.return_value = [
        {
            "chunk_id": "TEST_001",
            "content": "Test legal text",
            "topic": "Live-streaming rules",
            "information_type": "static",
            "score": 0.85,
        }
    ]
    mock_vs.get_stats.return_value = {"points_count": 229}

    retriever = KnowledgeRetriever(embedder=mock_embedder, vector_store=mock_vs)
    results = retriever.retrieve("What matters cannot be live-streamed?", top_k=1)

    assert len(results) == 1
    assert results[0]["chunk_id"] == "TEST_001"
    mock_embedder.embed_query.assert_called_once_with("What matters cannot be live-streamed?")
    mock_vs.search.assert_called_once()

