"""
Nyaya Sahayak — Semantic Retrieval Endpoint
"""

from fastapi import APIRouter, Depends, HTTPException
from app.models.request import RetrievalRequest
from app.models.response import RetrievalResponse, RetrievedChunk
from app.services.retriever import KnowledgeRetriever
from app.api.v1.health import get_retriever

router = APIRouter(tags=["Retrieval"])


@router.post("/retrieve", response_model=RetrievalResponse)
async def retrieve_knowledge(
    request: RetrievalRequest,
    retriever: KnowledgeRetriever = Depends(get_retriever),
):
    """Retrieve supporting knowledge base chunks for a legal or administrative query."""
    try:
        raw_results = retriever.retrieve(
            query=request.query,
            top_k=request.top_k,
            topic=request.topic,
            information_type=request.information_type,
            min_score=request.min_score,
        )

        chunks = [
            RetrievedChunk(
                chunk_id=r["chunk_id"],
                score=r["score"],
                source_document=r.get("source_document", ""),
                source_url=r.get("source_url", ""),
                page_number_or_range=r.get("page_number_or_range"),
                topic=r.get("topic", ""),
                information_type=r.get("information_type", "static"),
                publication_date=r.get("publication_date"),
                data_as_of=r.get("data_as_of"),
                fidelity_classification=r.get("fidelity_classification", "verbatim"),
                source_content=r.get("source_content", ""),
                derived_analysis=r.get("derived_analysis"),
                audit_notes=r.get("audit_notes"),
                content=r.get("content", ""),
            )
            for r in raw_results
        ]

        return RetrievalResponse(
            total=len(chunks),
            query=request.query,
            results=chunks,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic retrieval failed: {exc}",
        ) from exc

