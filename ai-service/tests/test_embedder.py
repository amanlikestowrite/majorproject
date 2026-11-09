"""
Unit tests for the embedding service.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from app.config import Settings
from app.services.embedder import EmbeddingService, EmbeddingModelLoader, resolve_device


def test_resolve_device():
    # Explicit override
    assert resolve_device("cpu") == "cpu"
    # Auto should return valid device string
    dev = resolve_device("auto")
    assert dev in {"mps", "cuda", "cpu"}


def test_embedding_service_with_mock():
    mock_model = MagicMock()
    # Mock encode returns 2 vectors of dim 1024
    mock_model.encode.return_value = np.ones((2, 1024), dtype=float)

    mock_loader = MagicMock(spec=EmbeddingModelLoader)
    mock_loader.load.return_value = mock_model
    mock_loader.model_name = "test-model"
    mock_loader.device = "cpu"
    mock_loader.is_loaded = True

    settings = Settings(embedding_dimension=1024, embedding_batch_size=2)
    service = EmbeddingService(settings=settings, loader=mock_loader)

    # Test embed_query
    vec = service.embed_query("What is eFiling?")
    assert len(vec) == 1024

    # Test empty query returns zero vector
    zero_vec = service.embed_query("")
    assert len(zero_vec) == 1024
    assert all(v == 0.0 for v in zero_vec)

    # Test batch
    batch_vecs = service.embed_documents(["doc 1", "doc 2"])
    assert len(batch_vecs) == 2
    assert len(batch_vecs[0]) == 1024
