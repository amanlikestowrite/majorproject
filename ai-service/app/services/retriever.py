"""
Nyaya Sahayak — Retrieval Service

Orchestrates semantic search with dense vector embeddings, metadata constraints,
temporal freshness auditing, and score filtering.
"""

import logging
from typing import Any, Dict, List, Optional

from app.config import Settings, get_settings
from app.services.embedder import EmbeddingService
from app.services.vector_store import QdrantVectorStore

logger = logging.getLogger(__name__)


class KnowledgeRetriever:
    """Coordinates embedding generation, vector search, and temporal filtering."""

    def __init__(
        self,
        embedder: Optional[EmbeddingService] = None,
        vector_store: Optional[QdrantVectorStore] = None,
        settings: Optional[Settings] = None,
    ):
        self.settings = settings or get_settings()
        self.embedder = embedder or EmbeddingService(settings=self.settings)
        self.vector_store = vector_store or QdrantVectorStore(settings=self.settings)

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        topic: Optional[str] = None,
        information_type: Optional[str] = None,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve the most relevant knowledge base chunks for a legal query."""
        k = top_k or self.settings.default_top_k
        logger.info(
            "Executing retrieval for query: '%s' (top_k=%d, topic=%s, info_type=%s)",
            query[:60],
            k,
            topic,
            information_type,
        )

        # 1. Generate query embedding
        query_vector = self.embedder.embed_query(query)

        # 2. Search vector store with filters
        raw_results = self.vector_store.search(
            query_vector=query_vector,
            top_k=k,
            topic=topic,
            information_type=information_type,
            min_score=min_score,
        )

        logger.info("Retrieved %d candidate chunks from vector store.", len(raw_results))

        # 3. Post-retrieval temporal & audit verification
        annotated_results = []
        for item in raw_results:
            result = dict(item)
            # Add currency flags
            is_dynamic = result.get("information_type") == "dynamic"
            result["is_point_in_time"] = is_dynamic
            result["has_audit_notes"] = bool(result.get("audit_notes"))
            annotated_results.append(result)

        return annotated_results

    def get_health(self) -> Dict[str, Any]:
        """Aggregate health status of embedder and vector database."""
        return {
            "embedding_model": self.embedder.get_info(),
            "vector_store": self.vector_store.get_stats(),
        }
