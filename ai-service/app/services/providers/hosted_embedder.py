"""
Nyaya Sahayak — Hosted BGE-M3 Embedding Provider

Implements dense vector embedding generation using hosted Hugging Face Inference
endpoints (e.g. Hugging Face Serverless Inference / Text Embeddings Inference) for BAAI/bge-m3.
Ensures zero local PyTorch/model memory footprint for 512 MB cloud deployment while
preserving the 1024-dimensional dense vector contract and L2 normalization.
"""

import logging
import math
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)


class HostedEmbeddingError(Exception):
    """Base exception for hosted embedding inference failures."""
    pass


class HostedAuthError(HostedEmbeddingError):
    """Raised when Hugging Face API credentials are missing, invalid, or unauthorized (HTTP 401/403)."""
    pass


class HostedModelLoadingError(HostedEmbeddingError):
    """Raised when the hosted model is cold and fails to load within the allocated retries (HTTP 503)."""
    pass


class HostedQuotaExhaustedError(HostedEmbeddingError):
    """Raised when rate limits or API quotas are exceeded (HTTP 429)."""
    pass


class HostedPaymentRequiredError(HostedEmbeddingError):
    """Raised when Hugging Face API requires pre-paid credits or a PRO subscription (HTTP 402)."""
    pass


class HostedTimeoutError(HostedEmbeddingError):
    """Raised when the request to the hosted inference API times out."""
    pass


class HostedDimensionMismatchError(HostedEmbeddingError):
    """Raised when the hosted provider returns vectors with dimensions other than expected (1024)."""
    pass


def l2_normalize(vector: List[float]) -> List[float]:
    """Compute L2 unit-norm for a dense float vector."""
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0.0 or math.isnan(norm):
        return vector
    return [x / norm for x in vector]


class HostedBgeM3EmbeddingService:
    """
    Client for hosted BAAI/bge-m3 inference via Hugging Face Serverless Inference Router.
    Produces 1024-dimensional L2-normalized dense embeddings identical in vector space
    to the locally loaded SentenceTransformer model.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        api_url: Optional[str] = None,
        model_name: str = "BAAI/bge-m3",
        expected_dim: int = 1024,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
        retry_delay_seconds: float = 2.0,
        normalize: bool = True,
        settings: Optional[Any] = None,
        client: Optional[httpx.Client] = None,
    ):
        if settings is not None:
            self.token = token or getattr(settings, "hf_token", None)
            self.api_url = api_url or getattr(
                settings,
                "hf_api_url",
                "https://router.huggingface.co/hf-inference/models/BAAI/bge-m3",
            )
            self.model_name = getattr(settings, "embedding_model_name", model_name)
            self.expected_dim = getattr(settings, "embedding_dimension", expected_dim)
            self.timeout_seconds = getattr(settings, "hf_timeout_seconds", timeout_seconds)
            self.max_retries = getattr(settings, "hf_max_retries", max_retries)
            self.retry_delay_seconds = getattr(settings, "hf_retry_delay_seconds", retry_delay_seconds)
            self.normalize = getattr(settings, "normalize_embeddings", normalize)
        else:
            self.token = token
            self.api_url = (
                api_url
                or "https://router.huggingface.co/hf-inference/models/BAAI/bge-m3"
            )
            self.model_name = model_name
            self.expected_dim = expected_dim
            self.timeout_seconds = timeout_seconds
            self.max_retries = max_retries
            self.retry_delay_seconds = retry_delay_seconds
            self.normalize = normalize

        # Sanitize token (strip whitespace if string)
        if self.token and isinstance(self.token, str):
            self.token = self.token.strip()

        # Injected or internal httpx client
        self._external_client = client

    @property
    def is_configured(self) -> bool:
        """Return True if an authentication token is provided."""
        return bool(self.token and len(self.token) > 0)

    def _get_client(self) -> httpx.Client:
        """Return a persistent or injected HTTP client."""
        if self._external_client is not None:
            return self._external_client
        return httpx.Client(timeout=self.timeout_seconds)

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
            logger.error("Error generating query embedding via hosted provider: %s", exc)
            raise

    def embed_documents(
        self, texts: List[str], batch_size: Optional[int] = None
    ) -> List[List[float]]:
        """Generate dense embeddings for a batch of documents using hosted inference."""
        if not texts:
            return []

        if not self.is_configured:
            raise HostedAuthError(
                "Hugging Face API token is not configured. Set HF_TOKEN environment variable."
            )

        cleaned_texts: List[str] = [t.strip() if t and t.strip() else " " for t in texts]

        # Chunk into sub-batches if necessary
        effective_batch_size = batch_size or len(cleaned_texts)
        all_embeddings: List[List[float]] = []

        for i in range(0, len(cleaned_texts), effective_batch_size):
            chunk = cleaned_texts[i : i + effective_batch_size]
            batch_vectors = self._send_inference_request(chunk)
            all_embeddings.extend(batch_vectors)

        return all_embeddings

    def _send_inference_request(self, inputs: List[str]) -> List[List[float]]:
        """Send HTTP request to Hugging Face inference router with retry handling."""
        client = self._get_client()

        # Header masking: Never log or print the token
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

        # Hugging Face feature-extraction / TEI accepts inputs as list of strings
        payload = {
            "inputs": inputs if len(inputs) > 1 else inputs[0],
            "parameters": {"truncate": True},
        }

        retries = 0
        last_error = None

        while retries <= self.max_retries:
            try:
                logger.debug(
                    "Sending hosted embedding request for %d texts to %s (attempt %d/%d)...",
                    len(inputs),
                    self.api_url,
                    retries + 1,
                    self.max_retries + 1,
                )

                response = client.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                )

                status = response.status_code

                if status == 200:
                    raw_data = response.json()
                    return self._parse_and_validate_response(raw_data, expected_count=len(inputs))

                elif status == 503:
                    # Model loading (cold start)
                    retries += 1
                    try:
                        err_body = response.json()
                        estimated_wait = float(err_body.get("estimated_time", self.retry_delay_seconds))
                    except Exception:
                        estimated_wait = self.retry_delay_seconds

                    wait_time = min(estimated_wait, 15.0)
                    logger.warning(
                        "Hosted model '%s' is cold/loading on Hugging Face (status 503). Retrying in %.1fs...",
                        self.model_name,
                        wait_time,
                    )
                    time.sleep(wait_time)
                    continue

                elif status == 429:
                    raise HostedQuotaExhaustedError(
                        "Hugging Face Inference API rate limit reached (HTTP 429). Upgrade tier or reduce concurrency."
                    )

                elif status == 402:
                    raise HostedPaymentRequiredError(
                        "Hugging Face Inference API requires pre-paid credits or a PRO subscription for this model (HTTP 402)."
                    )

                elif status in (401, 403):
                    raise HostedAuthError(
                        "Hugging Face API token authentication failed (HTTP %d). Check HF_TOKEN validity."
                        % status
                    )

                else:
                    err_msg = response.text[:200]
                    raise HostedEmbeddingError(
                        f"Hosted embedding endpoint returned unexpected HTTP status {status}: {err_msg}"
                    )

            except (httpx.TimeoutException, httpx.ConnectTimeout) as exc:
                retries += 1
                last_error = exc
                if retries > self.max_retries:
                    raise HostedTimeoutError(
                        f"Hosted embedding inference timed out after {self.timeout_seconds}s: {exc}"
                    ) from exc
                logger.warning("Hosted embedding request timed out. Retrying (%d/%d)...", retries, self.max_retries)
                time.sleep(self.retry_delay_seconds)

            except (
                HostedAuthError,
                HostedQuotaExhaustedError,
                HostedPaymentRequiredError,
                HostedDimensionMismatchError,
            ):
                raise

            except Exception as exc:
                retries += 1
                last_error = exc
                if retries > self.max_retries:
                    raise HostedEmbeddingError(f"Hosted embedding inference failed: {exc}") from exc
                time.sleep(self.retry_delay_seconds)

        raise HostedModelLoadingError(
            f"Hosted model '{self.model_name}' did not become ready after {self.max_retries} attempts: {last_error}"
        )

    def _parse_and_validate_response(
        self, raw_data: Any, expected_count: int
    ) -> List[List[float]]:
        """
        Parse and validate response structures from Hugging Face TEI or Pipeline:
        - 1D list: [dim] -> [[dim]]
        - 2D list: [[dim], [dim]] -> standard
        - 3D list: [[[dim], ...]] -> token level, extract CLS [0]
        """
        if not isinstance(raw_data, list):
            raise HostedEmbeddingError(
                f"Unexpected payload format from hosted embedder: expected list, got {type(raw_data).__name__}"
            )

        if len(raw_data) == 0:
            return []

        parsed_vectors: List[List[float]] = []

        first_elem = raw_data[0]
        if isinstance(first_elem, (int, float)):
            # 1D single vector returned
            parsed_vectors.append([float(x) for x in raw_data])
        elif isinstance(first_elem, list):
            if len(first_elem) > 0 and isinstance(first_elem[0], (int, float)):
                # 2D list of vectors
                for item in raw_data:
                    parsed_vectors.append([float(x) for x in item])
            elif len(first_elem) > 0 and isinstance(first_elem[0], list):
                # 3D list: token embeddings [batch, seq_len, dim]. Extract CLS token at index 0.
                for seq in raw_data:
                    cls_token_vec = [float(x) for x in seq[0]]
                    parsed_vectors.append(cls_token_vec)
            else:
                raise HostedEmbeddingError("Empty or unsupported inner list in hosted embedding response.")
        else:
            raise HostedEmbeddingError(
                f"Unexpected item type in response: {type(first_elem).__name__}"
            )

        # Dimension verification & Normalization
        validated_vectors: List[List[float]] = []
        for vec in parsed_vectors:
            actual_dim = len(vec)
            if actual_dim != self.expected_dim:
                raise HostedDimensionMismatchError(
                    f"Hosted model returned vector dimension {actual_dim}, but expected {self.expected_dim}. "
                    "Refusing to silently use incompatible vector representation."
                )

            # Check for non-finite values
            for val in vec:
                if math.isnan(val) or math.isinf(val):
                    raise HostedEmbeddingError("Hosted embedding vector contains NaN or Infinite value.")

            if self.normalize:
                vec = l2_normalize(vec)

            validated_vectors.append(vec)

        return validated_vectors

    def get_info(self) -> Dict[str, Any]:
        """Diagnostic metadata for health checks."""
        return {
            "model_name": self.model_name,
            "provider": "huggingface",
            "api_url": self.api_url,
            "dimension": self.expected_dim,
            "is_configured": self.is_configured,
            "normalized": self.normalize,
            "timeout_seconds": self.timeout_seconds,
        }

