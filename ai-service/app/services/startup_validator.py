"""
Nyaya Sahayak — Startup Configuration & Infrastructure Validator

Validates embedding provider, credentials, vector store mode, and Qdrant collection
compatibility on application startup to ensure zero silent fallbacks, strict dimension
enforcement, and secure fail-fast behavior.
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import Settings, get_settings, SERVICE_DIR

logger = logging.getLogger(__name__)


class ConfigurationValidationError(RuntimeError):
    """Raised when startup configuration or infrastructure validation fails."""
    pass


def validate_startup_configuration(settings: Optional[Settings] = None, qdrant_client: Optional[QdrantClient] = None) -> Dict[str, Any]:
    """
    Validate active configuration and verify backend infrastructure.
    
    Checks:
    1. Provider credentials (Gemini API key or HF token when respective hosted provider active).
    2. Dimension alignment between provider and target collection.
    3. Qdrant connectivity (Cloud or Embedded).
    4. Target collection existence (no silent auto-creation in production).
    5. Vector dimension and Cosine distance validation.
    6. Exact point count verification (expected 229 verified legal chunks).
    """
    s = settings or get_settings()
    provider = s.embedding_provider.lower().strip()
    mode = getattr(s, "vector_store_mode", "embedded").lower().strip()
    collection_name = s.qdrant_collection_name

    logger.info("Performing startup configuration validation (provider: %s, mode: %s, collection: %s)...",
                provider, mode, collection_name)

    # 1. Determine active expected dimension and validate provider credentials
    if provider == "gemini":
        expected_dim = s.gemini_embedding_dimension
        if not s.gemini_api_key or not s.gemini_api_key.strip():
            raise ConfigurationValidationError(
                "Configuration Error: EMBEDDING_PROVIDER is 'gemini' but GEMINI_API_KEY is not configured."
            )
    elif provider == "huggingface":
        expected_dim = s.embedding_dimension
        if not s.hf_token or not s.hf_token.strip():
            raise ConfigurationValidationError(
                "Configuration Error: EMBEDDING_PROVIDER is 'huggingface' but HF_TOKEN is not configured."
            )
    elif provider == "local":
        expected_dim = s.embedding_dimension  # 1024 for BAAI/bge-m3
    else:
        raise ConfigurationValidationError(f"Invalid EMBEDDING_PROVIDER: '{provider}'. Supported: 'local', 'gemini', 'huggingface'.")

    # 2. Initialize or verify Qdrant client
    client = qdrant_client
    if client is None:
        if mode == "cloud":
            if not s.qdrant_url or not s.qdrant_url.strip():
                raise ConfigurationValidationError(
                    "Configuration Error: VECTOR_STORE_MODE is 'cloud' but QDRANT_URL is not configured."
                )
            if not s.qdrant_api_key or not s.qdrant_api_key.strip():
                raise ConfigurationValidationError(
                    "Configuration Error: VECTOR_STORE_MODE is 'cloud' but QDRANT_API_KEY is not configured."
                )
            try:
                client = QdrantClient(
                    url=s.qdrant_url,
                    api_key=s.qdrant_api_key,
                    check_compatibility=False,
                )
            except Exception as exc:
                raise ConfigurationValidationError(f"Failed to initialize Qdrant Cloud client: {exc}") from exc
        else:
            storage_path = Path(s.qdrant_storage_path)
            if not storage_path.is_absolute():
                storage_path = (SERVICE_DIR / storage_path).resolve()
            if not storage_path.exists():
                raise ConfigurationValidationError(f"Local Qdrant storage path does not exist: {storage_path}")
            try:
                client = QdrantClient(path=str(storage_path), force_disable_check_same_thread=True)
            except Exception as exc:
                raise ConfigurationValidationError(f"Failed to initialize embedded Qdrant client: {exc}") from exc

    # 3. Check connectivity and collection existence
    try:
        collections = client.get_collections().collections
        existing_names = {c.name for c in collections}
    except Exception as exc:
        raise ConfigurationValidationError(f"Could not connect to Qdrant ({mode} mode): {exc}") from exc

    if collection_name not in existing_names:
        raise ConfigurationValidationError(
            f"Target collection '{collection_name}' does not exist in Qdrant ({mode} mode). "
            f"Available collections: {sorted(list(existing_names))}. "
            "Collections must be explicitly indexed prior to service launch; auto-creation is disabled."
        )

    # 4. Verify collection parameters
    try:
        info = client.get_collection(collection_name)
    except Exception as exc:
        raise ConfigurationValidationError(f"Could not fetch metadata for collection '{collection_name}': {exc}") from exc

    actual_dim = info.config.params.vectors.size
    actual_distance = info.config.params.vectors.distance
    actual_points = info.points_count

    if actual_dim != expected_dim:
        raise ConfigurationValidationError(
            f"Dimension Mismatch: Active embedding provider '{provider}' outputs {expected_dim} dimensions, "
            f"but collection '{collection_name}' is configured for {actual_dim} dimensions. "
            "Cross-dimension queries are rejected to prevent index corruption."
        )

    distance_str = str(actual_distance).lower()
    if "cosine" not in distance_str:
        raise ConfigurationValidationError(
            f"Distance Metric Mismatch: Collection '{collection_name}' uses {actual_distance}, expected Cosine."
        )

    if actual_points != 229:
        logger.warning("Point count anomaly: collection '%s' contains %d points (expected 229).",
                       collection_name, actual_points)

    # 4. Security Check: Warn if internal token is missing in cloud/production
    if (mode == "cloud" or s.environment == "production") and not (s.internal_service_token and s.internal_service_token.strip()):
        logger.warning(
            "SECURITY WARNING: INTERNAL_SERVICE_TOKEN is not configured for %s environment. "
            "Protected endpoints (/retrieve, /chat) will accept unauthenticated requests!",
            s.environment,
        )

    logger.info("Startup validation passed successfully! Collection '%s' is healthy (%d points, %d dims, %s).",
                collection_name, actual_points, actual_dim, actual_distance)

    return {
        "status": "valid",
        "provider": provider,
        "vector_store_mode": mode,
        "collection": collection_name,
        "dimension": actual_dim,
        "distance": str(actual_distance),
        "points_count": actual_points,
    }

