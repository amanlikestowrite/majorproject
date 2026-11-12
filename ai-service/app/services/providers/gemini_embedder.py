"""
Nyaya Sahayak — Official Google Gemini Hosted Embedding Provider

Implements dense vector embedding generation using the official `google-genai` SDK
and the `gemini-embedding-001` model. Supports configurable Matryoshka output dimensions
(768 or 3072), separate task types for retrieval documents and retrieval queries,
L2 normalization, batching, quota/timeout handling, and strict secret protection.
"""

import logging
import math
from typing import Any, Dict, List, Optional
from google import genai
from google.genai import errors, types

logger = logging.getLogger(__name__)


class GeminiEmbeddingError(Exception):
    """Base exception for Gemini embedding failures."""
    pass


class GeminiAuthError(GeminiEmbeddingError):
    """Raised when Gemini API credentials are missing, invalid, or unauthorized (HTTP 401/403)."""
    pass


class GeminiQuotaExhaustedError(GeminiEmbeddingError):
    """Raised when Gemini API rate limits or billing quotas are exhausted (HTTP 429 / RESOURCE_EXHAUSTED)."""
    pass


class GeminiTimeoutError(GeminiEmbeddingError):
    """Raised when a request to Gemini embedding service times out."""
    pass


class GeminiDimensionMismatchError(GeminiEmbeddingError):
    """Raised when returned vector dimensionality does not match expected output dimension."""
    pass


class GeminiInvalidInputError(GeminiEmbeddingError):
    """Raised when inputs are invalid (e.g. non-finite values or empty batches)."""
    pass


def l2_normalize(vector: List[float]) -> List[float]:
    """Compute L2 unit-norm for a dense float vector."""
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0.0 or math.isnan(norm):
        return vector
    return [x / norm for x in vector]


class GeminiEmbeddingService:
    """
    Embedding service using Google Gemini Developer API (gemini-embedding-001)
    via the official `google-genai` SDK.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gemini-embedding-001",
        expected_dim: int = 768,
        timeout_seconds: float = 30.0,
        batch_size: int = 16,
        normalize: bool = True,
        settings: Optional[Any] = None,
        client: Optional[genai.Client] = None,
    ):
        if settings is not None:
            self.api_key = api_key or getattr(settings, "gemini_api_key", None)
            self.model_name = getattr(settings, "gemini_embedding_model", model_name)
            self.expected_dim = getattr(settings, "gemini_embedding_dimension", expected_dim)
            self.timeout_seconds = getattr(settings, "gemini_timeout_seconds", timeout_seconds)
            self.batch_size = getattr(settings, "embedding_batch_size", batch_size)
            self.normalize = getattr(settings, "normalize_embeddings", normalize)
        else:
            self.api_key = api_key
            self.model_name = model_name
            self.expected_dim = expected_dim
            self.timeout_seconds = timeout_seconds
            self.batch_size = batch_size
            self.normalize = normalize

        if self.api_key:
            self.api_key = self.api_key.strip()

        # Injected or newly initialized genai.Client
        if client is not None:
            self._client = client
        elif self.api_key:
            self._client = genai.Client(api_key=self.api_key)
        else:
            self._client = None

    @property
    def is_configured(self) -> bool:
        """Return True if the service has an active client."""
        return self._client is not None

    def _ensure_configured(self) -> genai.Client:
        """Validate client readiness without exposing API key."""
        if self._client is None:
            raise GeminiAuthError(
                "Gemini API key is not configured. Set GEMINI_API_KEY in the environment or ai-service/.env."
            )
        return self._client

    def _handle_exception(self, exc: Exception) -> None:
        """Categorize SDK and network errors without exposing credentials."""
        err_str = str(exc).lower()
        err_name = type(exc).__name__.lower()

        if isinstance(
            exc,
            (
                GeminiAuthError,
                GeminiQuotaExhaustedError,
                GeminiTimeoutError,
                GeminiDimensionMismatchError,
                GeminiInvalidInputError,
            ),
        ):
            raise exc

        if isinstance(exc, errors.APIError):
            code = getattr(exc, "code", None)
            if code in (401, 403) or "unauthorized" in err_str or "forbidden" in err_str or "api_key_invalid" in err_str:
                raise GeminiAuthError(f"Gemini authentication failed (status {code}): {exc.message}") from exc
            if code == 429 or "resource_exhausted" in err_str or "quota" in err_str:
                raise GeminiQuotaExhaustedError(f"Gemini rate limit or quota exceeded (status {code}): {exc.message}") from exc
            if code in (408, 504) or "deadline_exceeded" in err_str or "timed out" in err_str:
                raise GeminiTimeoutError(f"Gemini request timed out (status {code}): {exc.message}") from exc

        if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
            raise GeminiQuotaExhaustedError(f"Gemini quota exhausted: {exc}") from exc
        if "timed out" in err_str or "timeout" in err_str or "timeout" in err_name:
            raise GeminiTimeoutError(f"Gemini request timed out after {self.timeout_seconds}s: {exc}") from exc
        if "api_key" in err_str or "unauthorized" in err_str or "401" in err_str or "403" in err_str:
            raise GeminiAuthError(f"Gemini authentication failure: {exc}") from exc

        raise GeminiEmbeddingError(f"Gemini embedding generation failed: {exc}") from exc

    def embed_query(self, text: str) -> List[float]:
        """
        Generate a dense embedding vector for a single query using task_type='RETRIEVAL_QUERY'.
        Applies L2 normalization if enabled.
        """
        if not text or not text.strip():
            logger.warning("Empty query received; returning zero vector of dimension %d.", self.expected_dim)
            return [0.0] * self.expected_dim

        client = self._ensure_configured()
        clean_text = text.strip()

        config = types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=self.expected_dim,
            http_options=types.HttpOptions(timeout=int(self.timeout_seconds * 1000)),
        )

        try:
            resp = client.models.embed_content(
                model=self.model_name,
                contents=clean_text,
                config=config,
            )
        except Exception as exc:
            self._handle_exception(exc)

        if not resp.embeddings or not resp.embeddings[0].values:
            raise GeminiEmbeddingError("Gemini returned empty embedding values for query.")

        raw_vec = resp.embeddings[0].values
        if len(raw_vec) != self.expected_dim:
            raise GeminiDimensionMismatchError(
                f"Dimension mismatch: expected {self.expected_dim}, got {len(raw_vec)}"
            )

        # Validate finite values
        for val in raw_vec:
            if math.isnan(val) or math.isinf(val):
                raise GeminiInvalidInputError("Gemini returned non-finite float value.")

        if self.normalize:
            return l2_normalize(raw_vec)
        return raw_vec

    def embed_documents(
        self, texts: List[str], batch_size: Optional[int] = None
    ) -> List[List[float]]:
        """
        Generate dense embeddings for a batch of documents using task_type='RETRIEVAL_DOCUMENT'.
        Applies L2 normalization if enabled.
        """
        if not texts:
            return []

        client = self._ensure_configured()
        bs = batch_size or self.batch_size
        cleaned_texts = [t.strip() if t and t.strip() else " " for t in texts]

        all_embeddings: List[List[float]] = []

        config = types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=self.expected_dim,
            http_options=types.HttpOptions(timeout=int(self.timeout_seconds * 1000)),
        )

        for i in range(0, len(cleaned_texts), bs):
            batch = cleaned_texts[i : i + bs]
            try:
                resp = client.models.embed_content(
                    model=self.model_name,
                    contents=batch,
                    config=config,
                )
            except Exception as exc:
                self._handle_exception(exc)

            if not resp.embeddings or len(resp.embeddings) != len(batch):
                raise GeminiEmbeddingError(
                    f"Gemini returned {len(resp.embeddings) if resp.embeddings else 0} embeddings "
                    f"for batch of size {len(batch)}."
                )

            for emb in resp.embeddings:
                raw_vec = emb.values
                if len(raw_vec) != self.expected_dim:
                    raise GeminiDimensionMismatchError(
                        f"Dimension mismatch: expected {self.expected_dim}, got {len(raw_vec)}"
                    )
                for val in raw_vec:
                    if math.isnan(val) or math.isinf(val):
                        raise GeminiInvalidInputError("Gemini returned non-finite float value.")

                if self.normalize:
                    all_embeddings.append(l2_normalize(raw_vec))
                else:
                    all_embeddings.append(raw_vec)

        return all_embeddings

    def get_info(self) -> Dict[str, Any]:
        """Diagnostic metadata regarding provider, model, dimension, and configuration."""
        return {
            "model_name": self.model_name,
            "provider": "gemini",
            "dimension": self.expected_dim,
            "task_types": {
                "query": "RETRIEVAL_QUERY",
                "document": "RETRIEVAL_DOCUMENT",
            },
            "batch_size": self.batch_size,
            "normalized": self.normalize,
            "is_configured": self.is_configured,
        }

