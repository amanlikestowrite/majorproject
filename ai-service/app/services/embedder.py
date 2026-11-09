"""
Nyaya Sahayak — Embedding Service

Provides local text embedding generation using BAAI/bge-m3 (or compatible dense models)
with automatic hardware acceleration (Apple Silicon MPS / CUDA / CPU fallback),
batching, L2 normalization, dimension validation, and error handling.
"""

import logging
import os
from typing import List, Optional, Union
import numpy as np
import torch

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Ensure offline operation using local HuggingFace cache
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


def resolve_device(preferred: str = "cpu") -> str:
    """Determine the optimal available compute device."""
    pref = preferred.lower().strip()
    if pref in {"mps", "cuda", "cpu"}:
        if pref == "mps" and torch.backends.mps.is_available():
            return "mps"
        if pref == "cuda" and torch.cuda.is_available():
            return "cuda"
        if pref == "cpu":
            return "cpu"
        logger.warning(
            "Preferred device '%s' requested but not available. Falling back to CPU.",
            pref,
        )

    if torch.cuda.is_available():
        logger.info("NVIDIA CUDA hardware acceleration detected and enabled.")
        return "cuda"

    # CPU is the most stable and fast engine for BGE-M3 on macOS (~0.03s per chunk)
    return "cpu"


class EmbeddingModelLoader:
    """Separates model loading and resource allocation from inference logic."""

    def __init__(self, model_name: str, device: str):
        self.model_name = model_name
        self.device = resolve_device(device)
        self._model = None

    def load(self):
        """Load and initialize the SentenceTransformer model."""
        if self._model is not None:
            return self._model

        logger.info(
            "Loading embedding model '%s' on device '%s'...",
            self.model_name,
            self.device,
        )
        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(
                self.model_name,
                device=self.device,
                trust_remote_code=True,
            )
            logger.info("Embedding model '%s' loaded successfully.", self.model_name)
            return self._model
        except Exception as exc:
            logger.error("Failed to load embedding model '%s': %s", self.model_name, exc)
            raise RuntimeError(
                f"Could not load embedding model '{self.model_name}': {exc}"
            ) from exc

    @property
    def is_loaded(self) -> bool:
        """Check if model is currently loaded in memory."""
        return self._model is not None


class EmbeddingService:
    """Core embedding service for legal text vectorization and query inference."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        loader: Optional[EmbeddingModelLoader] = None,
    ):
        self.settings = settings or get_settings()
        self.loader = loader or EmbeddingModelLoader(
            model_name=self.settings.embedding_model_name,
            device=self.settings.embedding_device,
        )
        self.expected_dim = self.settings.embedding_dimension
        self.batch_size = self.settings.embedding_batch_size
        self.normalize = self.settings.normalize_embeddings

    @property
    def model(self):
        """Lazy-load the model upon first request."""
        return self.loader.load()

    def embed_query(self, text: str) -> List[float]:
        """Generate dense embedding for an individual search query."""
        if not text or not text.strip():
            logger.warning("Empty query string received; returning zero vector.")
            return [0.0] * self.expected_dim

        clean_text = text.strip()
        try:
            embeddings = self.embed_documents([clean_text], batch_size=1)
            return embeddings[0]
        except Exception as exc:
            logger.error("Error generating query embedding for '%s': %s", clean_text[:50], exc)
            raise

    def embed_documents(
        self, texts: List[str], batch_size: Optional[int] = None
    ) -> List[List[float]]:
        """Generate dense embeddings for a batch of documents."""
        if not texts:
            return []

        bs = batch_size or self.batch_size
        cleaned_texts: List[str] = [t.strip() if t and t.strip() else " " for t in texts]

        try:
            logger.debug(
                "Encoding batch of %d texts (batch_size=%d, normalize=%s)...",
                len(cleaned_texts),
                bs,
                self.normalize,
            )
            raw_embeddings = self.model.encode(
                cleaned_texts,
                batch_size=bs,
                normalize_embeddings=self.normalize,
                show_progress_bar=False,
                convert_to_numpy=True,
            )

            # Ensure 2D numpy array
            if isinstance(raw_embeddings, list):
                raw_embeddings = np.array(raw_embeddings)
            elif len(raw_embeddings.shape) == 1:
                raw_embeddings = np.expand_dims(raw_embeddings, axis=0)

            # Validate dimensions
            num_vectors, actual_dim = raw_embeddings.shape
            if actual_dim != self.expected_dim:
                logger.warning(
                    "Embedding dimension mismatch: expected %d, model returned %d. Updating dimension.",
                    self.expected_dim,
                    actual_dim,
                )
                self.expected_dim = actual_dim

            # Convert to standard Python float lists
            return raw_embeddings.astype(float).tolist()

        except Exception as exc:
            logger.error("Inference failure during batch embedding: %s", exc)
            raise RuntimeError(f"Embedding batch encoding failed: {exc}") from exc

    def get_info(self) -> dict:
        """Diagnostic metadata regarding model name, compute device, and vector dimension."""
        return {
            "model_name": self.loader.model_name,
            "device": self.loader.device,
            "dimension": self.expected_dim,
            "is_loaded": self.loader.is_loaded,
            "batch_size": self.batch_size,
            "normalized": self.normalize,
        }

