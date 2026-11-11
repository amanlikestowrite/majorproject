"""
Nyaya Sahayak — API Response Schemas

Matches the presentation contract consumed by the frontend assistant renderer
and database persistence in the application gateway.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class PortalInfo(BaseModel):
    """Official government portal metadata."""

    title: str = Field(..., description="Portal display name")
    url: str = Field(..., description="Direct HTTPS link to the government service")
    domain: str = Field(..., description="Domain hostname (e.g., doj.gov.in)")


class Citation(BaseModel):
    """Verifiable source citation for statutory audit."""

    chunk_id: str = Field(..., description="Deterministic chunk identifier")
    document: str = Field(..., description="Official source publication or gazette name")
    page_range: Optional[str] = Field(None, description="Physical page number or range")
    source_url: str = Field(..., description="Official government download URL")
    fidelity_classification: str = Field(
        ...,
        description="Fidelity status (verbatim, structured_from_source, derived_with_audit_note)",
    )
    data_as_of: Optional[str] = Field(None, description="Factual currency timestamp")
    publication_date: Optional[str] = Field(None, description="Gazette / release date")
    information_type: Optional[str] = Field("static", description="'static' or 'dynamic'")


class AuditMetadata(BaseModel):
    """Metadata tracking calculation derivations and typographical corrections."""

    information_type: str = Field(..., description="'static' or 'dynamic'")
    publication_date: Optional[str] = Field(None, description="Gazette / release date")
    derived_analysis: Optional[str] = Field(None, description="Mathematical derivations if any")
    audit_notes: Optional[str] = Field(None, description="Typographical or clerical audit notes")


class ChatResponse(BaseModel):
    """Primary conversational response matching the frontend UI card contract."""

    userId: Optional[str] = Field(None, description="Conversation or user UUID")
    conversationId: Optional[str] = Field(None, description="Persistent conversation thread UUID")
    summary: str = Field(
        ...,
        description="Core legal or procedural answer (HTML formatted or plain text)",
    )
    steps: List[str] = Field(
        default_factory=list,
        description="Ordered list of step-by-step procedural directions",
    )
    important: Optional[str] = Field(
        None,
        description="Statutory caveats, legal disclaimers, or critical warnings",
    )
    portal: Optional[PortalInfo] = Field(
        None,
        description="Official portal link card metadata",
    )
    source: str = Field(
        ...,
        description="Official authority attribution statement",
    )
    followUps: List[str] = Field(
        default_factory=list,
        description="Contextual follow-up question chips",
    )
    citations: List[Citation] = Field(
        default_factory=list,
        description="Supporting knowledge chunks with page citations",
    )
    audit: Optional[AuditMetadata] = Field(
        None,
        description="Provenance and derivation metadata",
    )
    generation_status: str = Field(
        "grounded_generation",
        description="Generation status: 'grounded_generation', 'evidence_only', 'abstained_insufficient_evidence', or 'provider_unavailable'",
    )
    provider: str = Field(
        "gemini",
        description="AI generation provider, e.g. 'gemini' or 'none'",
    )
    model: Optional[str] = Field(
        None,
        description="Actual LLM model identifier used for generation",
    )
    conflicting_sources_flag: bool = Field(
        False,
        description="Flag indicating whether conflicting official data was detected across sources",
    )


class RetrievedChunk(BaseModel):
    """Detailed chunk item returned by the retrieval endpoint."""

    chunk_id: str
    score: float
    source_document: str
    source_url: str
    page_number_or_range: Optional[str]
    topic: str
    information_type: str
    publication_date: Optional[str]
    data_as_of: Optional[str]
    fidelity_classification: str
    source_content: str
    derived_analysis: Optional[str] = None
    audit_notes: Optional[str] = None
    content: str


class RetrievalResponse(BaseModel):
    """Results returned by the semantic retrieval endpoint."""

    total: int
    query: str
    results: List[RetrievedChunk]


class HealthResponse(BaseModel):
    """Service health and diagnostic status."""

    status: str
    service: str = "nyaya-sahayak-ai-service"
    version: str = "1.0.0"
    vector_store: Dict[str, Any]
    embedding_model: Dict[str, Any]

