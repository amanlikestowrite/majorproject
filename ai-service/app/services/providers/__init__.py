"""
Nyaya Sahayak — AI Providers Package
"""

from app.services.providers.gemini_provider import (
    GeminiProvider,
    GeminiProviderError,
    ProviderNotConfiguredError,
    ProviderTimeoutError,
    QuotaExhaustedError,
    InvalidJSONError,
)
from app.services.providers.hosted_embedder import (
    HostedBgeM3EmbeddingService,
    HostedEmbeddingError,
    HostedAuthError,
    HostedModelLoadingError,
    HostedQuotaExhaustedError,
    HostedPaymentRequiredError,
    HostedTimeoutError,
    HostedDimensionMismatchError,
)
from app.services.providers.gemini_embedder import (
    GeminiEmbeddingService,
    GeminiEmbeddingError,
    GeminiAuthError,
    GeminiQuotaExhaustedError,
    GeminiTimeoutError,
    GeminiDimensionMismatchError,
    GeminiInvalidInputError,
)

__all__ = [
    "GeminiProvider",
    "GeminiProviderError",
    "ProviderNotConfiguredError",
    "ProviderTimeoutError",
    "QuotaExhaustedError",
    "InvalidJSONError",
    "HostedBgeM3EmbeddingService",
    "HostedEmbeddingError",
    "HostedAuthError",
    "HostedModelLoadingError",
    "HostedQuotaExhaustedError",
    "HostedPaymentRequiredError",
    "HostedTimeoutError",
    "HostedDimensionMismatchError",
    "GeminiEmbeddingService",
    "GeminiEmbeddingError",
    "GeminiAuthError",
    "GeminiQuotaExhaustedError",
    "GeminiTimeoutError",
    "GeminiDimensionMismatchError",
    "GeminiInvalidInputError",
]
