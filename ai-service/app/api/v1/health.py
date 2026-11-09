"""
Nyaya Sahayak — Health Endpoint
"""

from fastapi import APIRouter, Depends
from app.models.response import HealthResponse
from app.services.retriever import KnowledgeRetriever

router = APIRouter(tags=["Health & Diagnostics"])

# Singleton retriever dependency
_retriever_instance = None


def get_retriever() -> KnowledgeRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = KnowledgeRetriever()
    return _retriever_instance


@router.get("/health", response_model=HealthResponse)
async def check_health(retriever: KnowledgeRetriever = Depends(get_retriever)):
    """Return health diagnostic metrics for embedding model and vector database."""
    health_data = retriever.get_health()
    return HealthResponse(
        status="healthy",
        service="nyaya-sahayak-ai-service",
        version="1.0.0",
        vector_store=health_data["vector_store"],
        embedding_model=health_data["embedding_model"],
    )
