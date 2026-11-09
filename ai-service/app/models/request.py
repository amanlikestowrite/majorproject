"""
Nyaya Sahayak — API Request Schemas
"""

from typing import Optional
from pydantic import BaseModel, Field


class ChatQueryRequest(BaseModel):
    """Payload sent by the Express gateway to generate an answer with citations."""

    userId: Optional[str] = Field(
        default=None,
        description="Active conversation or user UUID from the application gateway",
    )
    conversationId: Optional[str] = Field(
        default=None,
        description="Persistent conversation thread UUID if already initialized",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="Litigant or citizen legal inquiry string",
        examples=["What are the rules regarding live streaming of court proceedings?"],
    )
    language: Optional[str] = Field(
        default="en",
        description="Target response language ISO code (e.g., 'en', 'hi')",
    )
    topic: Optional[str] = Field(
        default=None,
        description="Optional canonical DoJ domain topic constraint",
    )
    top_k: Optional[int] = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum supporting knowledge chunks to retrieve",
    )


class RetrievalRequest(BaseModel):
    """Payload for direct semantic search against the knowledge base."""

    query: str = Field(
        ...,
        min_length=1,
        description="Search query string",
        examples=["Supreme Court judge vacancy sanctioned strength"],
    )
    top_k: Optional[int] = Field(
        default=3,
        ge=1,
        le=20,
        description="Maximum chunks to retrieve",
    )
    topic: Optional[str] = Field(
        default=None,
        description="Filter by one of the 8 canonical DoJ topics",
    )
    information_type: Optional[str] = Field(
        default=None,
        description="Filter by 'static' or 'dynamic'",
    )
    min_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity cutoff score",
    )

