"""
Nyaya Sahayak — Chat & Conversational Guidance Endpoint
"""

from fastapi import APIRouter, Depends, HTTPException
from app.models.request import ChatQueryRequest
from app.models.response import ChatResponse
from app.services.retriever import KnowledgeRetriever
from app.services.generator import ResponseSynthesizer
from app.api.v1.health import get_retriever

router = APIRouter(tags=["Conversational Guidance"])


@router.post("/chat", response_model=ChatResponse)
async def generate_legal_guidance(
    request: ChatQueryRequest,
    retriever: KnowledgeRetriever = Depends(get_retriever),
):
    """Generate grounded, structured legal guidance matching the frontend card schema."""
    try:
        retrieved_chunks = retriever.retrieve(
            query=request.message,
            top_k=request.top_k,
            topic=request.topic,
        )

        response = ResponseSynthesizer.synthesize(
            query=request.message,
            retrieved_chunks=retrieved_chunks,
            user_id=request.userId,
            language=request.language or "en",
        )

        return response

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Conversational generation failed: {exc}",
        ) from exc
