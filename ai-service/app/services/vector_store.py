"""
Nyaya Sahayak — Vector Database Service (Qdrant Embedded)

Provides zero-Docker, in-process vector indexing and search using QdrantClient
with local disk persistence, schema indexing, and payload metadata filtering.
"""

import logging
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import Settings, get_settings, SERVICE_DIR

logger = logging.getLogger(__name__)


def generate_point_id(chunk_id: str) -> str:
    """Generate a deterministic UUID from chunk_id for stable point identification."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk_id))


class QdrantVectorStore:
    """Qdrant vector database interface supporting embedded and cloud deployments."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        client: Optional[QdrantClient] = None,
    ):
        self.settings = settings or get_settings()
        self.storage_path = Path(self.settings.qdrant_storage_path)
        if not self.storage_path.is_absolute():
            self.storage_path = (SERVICE_DIR / self.storage_path).resolve()
        self.collection_name = self.settings.qdrant_collection_name
        if getattr(self.settings, "embedding_provider", "local") == "gemini":
            self.vector_dim = getattr(self.settings, "gemini_embedding_dimension", 768)
        else:
            self.vector_dim = self.settings.embedding_dimension

        if client is not None:
            self.client = client
            self.is_cloud = bool(getattr(self.settings, "vector_store_mode", "embedded") == "cloud" or self.settings.qdrant_url)
        elif getattr(self.settings, "vector_store_mode", "embedded") == "cloud" and self.settings.qdrant_url:
            logger.info(
                "Initializing Qdrant Cloud client (collection: '%s')...",
                self.collection_name,
            )
            self.client = QdrantClient(
                url=self.settings.qdrant_url,
                api_key=self.settings.qdrant_api_key,
                check_compatibility=False,
            )
            self.is_cloud = True
        else:
            self.storage_path.mkdir(parents=True, exist_ok=True)
            logger.info(
                "Initializing embedded Qdrant vector store at '%s' (collection: '%s')...",
                self.storage_path,
                self.collection_name,
            )
            self.client = QdrantClient(path=str(self.storage_path), force_disable_check_same_thread=True)
            self.is_cloud = False

        self._ensure_collection()

    def _ensure_collection(self) -> None:
        """Create the collection if it does not already exist."""
        collections = self.client.get_collections().collections
        existing_names = {c.name for c in collections}

        if self.collection_name not in existing_names:
            logger.info(
                "Creating collection '%s' with vector size %d and Cosine distance.",
                self.collection_name,
                self.vector_dim,
            )
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=qmodels.VectorParams(
                    size=self.vector_dim,
                    distance=qmodels.Distance.COSINE,
                ),
            )
            # Create payload indices for fast filtering
            self._create_payload_indices()
        else:
            logger.info("Collection '%s' already exists.", self.collection_name)
            try:
                coll_info = self.client.get_collection(collection_name=self.collection_name)
                actual_size = getattr(coll_info.config.params.vectors, "size", None)
                if isinstance(actual_size, int):
                    self.vector_dim = actual_size
            except Exception:
                pass

    def _create_payload_indices(self) -> None:
        """Create indices on filterable payload fields."""
        fields_to_index = [
            ("topic", qmodels.PayloadSchemaType.KEYWORD),
            ("information_type", qmodels.PayloadSchemaType.KEYWORD),
            ("data_as_of", qmodels.PayloadSchemaType.KEYWORD),
            ("fidelity_classification", qmodels.PayloadSchemaType.KEYWORD),
        ]
        for field_name, schema_type in fields_to_index:
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field_name,
                    field_schema=schema_type,
                )
                logger.debug("Created index for field '%s'.", field_name)
            except Exception as exc:
                logger.debug("Payload index for '%s' already configured or skipped: %s", field_name, exc)

    def upsert_chunks(
        self,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> int:
        """Upsert a batch of chunks and their dense embeddings into Qdrant."""
        if len(chunks) != len(embeddings):
            raise ValueError(
                f"Mismatch: received {len(chunks)} chunks but {len(embeddings)} embeddings."
            )

        points = []
        for chunk, vector in zip(chunks, embeddings):
            chunk_id = chunk["chunk_id"]
            point_id = generate_point_id(chunk_id)

            payload = {
                "chunk_id": chunk_id,
                "source_document": chunk.get("source_document", ""),
                "source_url": chunk.get("source_url", ""),
                "page_number_or_range": chunk.get("page_number_or_range", ""),
                "topic": chunk.get("topic", ""),
                "publication_date": chunk.get("publication_date", ""),
                "data_as_of": chunk.get("data_as_of", ""),
                "collection_timestamp": chunk.get("collection_timestamp", ""),
                "information_type": chunk.get("information_type", "static"),
                "extraction_method": chunk.get("extraction_method", ""),
                "content_type": chunk.get("content_type", ""),
                "fidelity_classification": chunk.get("fidelity_classification", "verbatim"),
                "tokenizer": chunk.get("tokenizer", ""),
                "token_count": chunk.get("token_count", 0),
                "source_content": chunk.get("source_content", ""),
                "derived_analysis": chunk.get("derived_analysis"),
                "audit_notes": chunk.get("audit_notes"),
                "content": chunk.get("content", ""),
            }

            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )
        logger.info("Successfully upserted %d points to '%s'.", len(points), self.collection_name)
        return len(points)

    def search(
        self,
        query_vector: List[float],
        top_k: int = 3,
        topic: Optional[str] = None,
        information_type: Optional[str] = None,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Search for top_k nearest chunks with optional metadata filters."""
        if len(query_vector) != self.vector_dim:
            raise ValueError(
                f"Query vector dimension mismatch: query has {len(query_vector)} dimensions, "
                f"but collection '{self.collection_name}' requires {self.vector_dim} dimensions. "
                f"Verify that EMBEDDING_PROVIDER matches vector store configuration."
            )

        filter_conditions = []

        if topic:
            filter_conditions.append(
                qmodels.FieldCondition(
                    key="topic",
                    match=qmodels.MatchValue(value=topic),
                )
            )

        if information_type:
            filter_conditions.append(
                qmodels.FieldCondition(
                    key="information_type",
                    match=qmodels.MatchValue(value=information_type),
                )
            )

        qdrant_filter = (
            qmodels.Filter(must=filter_conditions) if filter_conditions else None
        )

        score_threshold = min_score if min_score is not None else self.settings.score_threshold

        query_response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=top_k,
            query_filter=qdrant_filter,
            score_threshold=score_threshold,
        )

        results = []
        for hit in query_response.points:
            hit_data = dict(hit.payload)
            hit_data["score"] = float(hit.score)
            results.append(hit_data)

        return results

    def get_stats(self) -> Dict[str, Any]:
        """Return diagnostic metrics for the collection."""
        mode = "cloud" if getattr(self, "is_cloud", False) else "embedded"
        target_path = (
            self.settings.qdrant_url
            if getattr(self, "is_cloud", False)
            else str(self.storage_path)
        )
        try:
            info = self.client.get_collection(collection_name=self.collection_name)
            return {
                "engine": "qdrant",
                "mode": mode,
                "collection": self.collection_name,
                "total_indexed_chunks": info.points_count,
                "status": str(info.status),
                "vector_dimension": self.vector_dim,
                "storage_path": target_path,
            }
        except Exception as exc:
            return {
                "engine": "qdrant",
                "mode": mode,
                "collection": self.collection_name,
                "total_indexed_chunks": 0,
                "status": f"uninitialized: {exc}",
                "vector_dimension": self.vector_dim,
                "storage_path": target_path,
            }

