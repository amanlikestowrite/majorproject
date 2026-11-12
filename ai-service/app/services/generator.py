"""
Nyaya Sahayak — Grounded Legal Response Synthesis Service

Coordinates evidence validation, Gemini generation via the official google-genai SDK,
citation verification, untrusted document isolation, and transparent evidence-only fallback.
"""

import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.config import get_settings
from app.models.response import (
    AuditMetadata,
    ChatResponse,
    Citation,
    PortalInfo,
)
from app.services.providers.gemini_provider import (
    GeminiProvider,
    GeminiProviderError,
    ProviderNotConfiguredError,
    ProviderTimeoutError,
    QuotaExhaustedError,
    InvalidJSONError,
)

logger = logging.getLogger(__name__)

# Canonical Official Portals Registry
CANONICAL_PORTALS = {
    "doj": {
        "title": "Department of Justice Official Portal",
        "url": "https://doj.gov.in",
        "domain": "doj.gov.in",
    },
    "ecourts": {
        "title": "eCourts Services Portal",
        "url": "https://services.ecourts.gov.in",
        "domain": "services.ecourts.gov.in",
    },
    "efiling": {
        "title": "eCourts eFiling 3.0 Portal",
        "url": "https://efiling.ecourts.gov.in",
        "domain": "efiling.ecourts.gov.in",
    },
    "vcourts": {
        "title": "Virtual Courts Traffic Challan Portal",
        "url": "https://vcourts.gov.in",
        "domain": "vcourts.gov.in",
    },
    "tele_law": {
        "title": "Tele-Law Citizen Legal Aid Portal",
        "url": "https://www.tele-law.in",
        "domain": "tele-law.in",
    },
    "njdg": {
        "title": "National Judicial Data Grid (NJDG)",
        "url": "https://njdg.ecourts.gov.in",
        "domain": "njdg.ecourts.gov.in",
    },
}


def resolve_portal_for_topic(topic: str, source_url: Optional[str] = None) -> PortalInfo:
    """Resolve the most accurate official government portal for a given topic."""
    t_lower = topic.lower() if topic else ""

    if "tele-law" in t_lower or "legal aid" in t_lower:
        data = CANONICAL_PORTALS["tele_law"]
    elif "virtual court" in t_lower or "traffic" in t_lower or "challan" in t_lower:
        data = CANONICAL_PORTALS["vcourts"]
    elif "efiling" in t_lower:
        data = CANONICAL_PORTALS["efiling"]
    elif "njdg" in t_lower or "pendency" in t_lower:
        data = CANONICAL_PORTALS["njdg"]
    elif "ecourts" in t_lower or "case status" in t_lower:
        data = CANONICAL_PORTALS["ecourts"]
    elif source_url and "gov.in" in source_url:
        domain = urlparse(source_url).netloc
        data = {
            "title": f"Official Portal ({domain})",
            "url": source_url,
            "domain": domain,
        }
    else:
        data = CANONICAL_PORTALS["doj"]

    return PortalInfo(
        title=data["title"],
        url=data["url"],
        domain=data["domain"],
    )


def extract_procedural_steps(content: str) -> List[str]:
    """Parse ordered or bulleted steps from structured markdown content."""
    steps = []
    lines = content.split("\n")
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(("- ", "* ", "1. ", "2. ", "3. ", "4. ", "5. ", "6. ")):
            cleaned = stripped.lstrip("-*0123456789. ")
            if len(cleaned) > 10 and not cleaned.startswith("#"):
                steps.append(cleaned)
        if len(steps) >= 4:
            break

    if not steps:
        paragraphs = [p.strip() for p in content.split("\n\n") if len(p.strip()) > 30 and not p.strip().startswith("#")]
        steps = paragraphs[:3]

    return steps


def build_citations_from_chunks(chunks: List[Dict[str, Any]]) -> List[Citation]:
    """Construct verified Citation models directly from retrieved chunk metadata."""
    citations: List[Citation] = []
    for chunk in chunks:
        citations.append(
            Citation(
                chunk_id=chunk["chunk_id"],
                document=chunk.get("source_document", "Official DoJ Document"),
                page_range=chunk.get("page_number_or_range"),
                source_url=chunk.get("source_url", "https://doj.gov.in"),
                fidelity_classification=chunk.get("fidelity_classification", "verbatim"),
                data_as_of=chunk.get("data_as_of"),
                publication_date=chunk.get("publication_date"),
                information_type=chunk.get("information_type", "static"),
            )
        )
    return citations


class ResponseSynthesizer:
    """Coordinates grounded legal response generation, citation verification, and fallback."""

    @classmethod
    def synthesize_evidence_only(
        cls,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        failure_reason: Optional[str] = None,
    ) -> ChatResponse:
        """
        Return an explicit evidence-only response when Gemini is not configured or unavailable.
        Never fabricates a synthesized answer to hide provider failure.
        """
        if not retrieved_chunks:
            portal = CANONICAL_PORTALS["doj"]
            return ChatResponse(
                userId=user_id,
                conversationId=conversation_id,
                summary="No matching official record was located. No matching official Department of Justice record was located with sufficient evidence to answer this inquiry.",
                steps=[
                    "Check if your inquiry relates to Case Status, Traffic Challans, eFiling, Free Legal Aid, or Judicial Appointments.",
                    "Verify the CNR number or specific procedural category and query again.",
                    "For certified court orders and judicial filings, refer directly to official court portals.",
                ],
                important="Abstention Notice: Insufficient evidence in official knowledge base. This service provides administrative and procedural guidance only.",
                portal=PortalInfo(
                    title=portal["title"],
                    url=portal["url"],
                    domain=portal["domain"],
                ),
                source="Department of Justice, Ministry of Law & Justice, Govt. of India",
                followUps=[
                    "How can I check my case status online?",
                    "How do I pay a traffic challan in Virtual Courts?",
                    "What are the eligibility criteria for Tele-Law free legal aid?",
                ],
                citations=[],
                audit=None,
                generation_status="abstained_insufficient_evidence",
                provider="none",
                model=None,
                conflicting_sources_flag=False,
            )

        primary = retrieved_chunks[0]
        topic = primary.get("topic", "Department of Justice")
        primary_content = primary.get("source_content") or primary.get("content", "")
        portal = resolve_portal_for_topic(topic, primary.get("source_url"))
        citations = build_citations_from_chunks(retrieved_chunks)

        paragraphs = [p.strip() for p in primary_content.split("\n\n") if len(p.strip()) > 20 and not p.strip().startswith("#")]
        first_p = paragraphs[0] if paragraphs else primary_content[:300]

        reason_prefix = f" [{failure_reason}]" if failure_reason else " [AI Generation Unavailable]"
        summary = (
            f"{reason_prefix} AI synthesis was not performed. Below is the verified official record retrieved for your query:\n\n"
            f"{first_p}"
        )

        steps = extract_procedural_steps(primary_content)

        important = "Notice: This response contains raw verified government text without AI synthesis."
        if primary.get("information_type") == "dynamic":
            as_of = primary.get("data_as_of", "publication date")
            important += f" Point-in-Time Statistic: This metric reflects official data as of {as_of}. Statistical currency: Real-time statistics are updated monthly by the Department of Justice."

        doc_name = primary.get("source_document", "Department of Justice")
        page_info = f" (Page {primary.get('page_number_or_range')})" if primary.get("page_number_or_range") else ""
        as_of_info = f" [Data as of {primary.get('data_as_of')}]" if primary.get("data_as_of") else ""
        source_stmt = f"{doc_name}{page_info}{as_of_info} — Ministry of Law & Justice, Govt. of India"

        audit = AuditMetadata(
            information_type=primary.get("information_type", "static"),
            publication_date=primary.get("publication_date"),
            derived_analysis=primary.get("derived_analysis"),
            audit_notes=primary.get("audit_notes"),
        )

        return ChatResponse(
            userId=user_id,
            conversationId=conversation_id,
            summary=summary,
            steps=steps,
            important=important,
            portal=portal,
            source=source_stmt,
            followUps=[
                f"Where can I find certified records for {topic}?",
                "What is the official procedure on the government portal?",
            ],
            citations=citations,
            audit=audit,
            generation_status="evidence_only",
            provider="none",
            model=None,
            conflicting_sources_flag=False,
        )

    @classmethod
    async def synthesize_async(
        cls,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        language: str = "en",
        provider: Optional[GeminiProvider] = None,
    ) -> ChatResponse:
        """
        Asynchronously generate a grounded legal answer using Gemini.
        Falls back cleanly to an explicitly labelled evidence-only result if Gemini is unavailable.
        """
        if not retrieved_chunks:
            return cls.synthesize_evidence_only(
                query=query,
                retrieved_chunks=[],
                user_id=user_id,
                conversation_id=conversation_id,
            )

        settings = get_settings()

        # Initialize provider if not injected
        if provider is None:
            provider = GeminiProvider(
                api_key=settings.gemini_api_key,
                model_name=settings.gemini_model_name,
                temperature=settings.gemini_temperature,
                max_output_tokens=settings.gemini_max_output_tokens,
                timeout_seconds=settings.gemini_timeout_seconds,
            )

        if not provider.is_configured:
            return cls.synthesize_evidence_only(
                query=query,
                retrieved_chunks=retrieved_chunks,
                user_id=user_id,
                conversation_id=conversation_id,
                failure_reason="Gemini API key is not configured",
            )

        try:
            result = await provider.generate_grounded_answer(
                query=query,
                context_chunks=retrieved_chunks,
                language=language,
            )

            primary = retrieved_chunks[0]
            topic = primary.get("topic", "Department of Justice")
            portal = resolve_portal_for_topic(topic, primary.get("source_url"))

            # Build map of all valid citations
            all_citations_map = {c["chunk_id"]: c for c in retrieved_chunks if "chunk_id" in c}

            # Filter citations to only those cited by the model
            cited_ids = result.get("cited_chunk_ids", [])
            selected_chunks = [all_citations_map[cid] for cid in cited_ids if cid in all_citations_map]
            if not selected_chunks and not result.get("abstained"):
                selected_chunks = retrieved_chunks

            citations = build_citations_from_chunks(selected_chunks)

            doc_name = primary.get("source_document", "Department of Justice")
            page_info = f" (Page {primary.get('page_number_or_range')})" if primary.get("page_number_or_range") else ""
            as_of_info = f" [Data as of {primary.get('data_as_of')}]" if primary.get("data_as_of") else ""
            source_stmt = f"{doc_name}{page_info}{as_of_info} — Ministry of Law & Justice, Govt. of India"

            audit = AuditMetadata(
                information_type=primary.get("information_type", "static"),
                publication_date=primary.get("publication_date"),
                derived_analysis=primary.get("derived_analysis"),
                audit_notes=primary.get("audit_notes"),
            )

            if result.get("abstained"):
                return ChatResponse(
                    userId=user_id,
                    conversationId=conversation_id,
                    summary=result["summary"],
                    steps=result.get("steps", []),
                    important=result.get("abstention_reason") or "Abstention: Insufficient factual evidence in official records.",
                    portal=portal,
                    source=source_stmt,
                    followUps=result.get("followUps", []),
                    citations=[],
                    audit=audit,
                    generation_status="abstained_insufficient_evidence",
                    provider="gemini",
                    model=provider.model_name,
                    conflicting_sources_flag=False,
                )

            return ChatResponse(
                userId=user_id,
                conversationId=conversation_id,
                summary=result["summary"],
                steps=result.get("steps", []),
                important=result.get("important"),
                portal=portal,
                source=source_stmt,
                followUps=result.get("followUps", []),
                citations=citations,
                audit=audit,
                generation_status="grounded_generation",
                provider="gemini",
                model=provider.model_name,
                conflicting_sources_flag=result.get("conflicting_sources", False),
            )

        except (ProviderTimeoutError, QuotaExhaustedError, InvalidJSONError, GeminiProviderError, Exception) as exc:
            logger.warning(
                "Gemini generation failed (%s: %s); returning explicitly labelled evidence-only response.",
                type(exc).__name__,
                exc,
            )
            return cls.synthesize_evidence_only(
                query=query,
                retrieved_chunks=retrieved_chunks,
                user_id=user_id,
                conversation_id=conversation_id,
                failure_reason=f"AI Provider Error: {type(exc).__name__}",
            )

    @classmethod
    def synthesize_deterministic(
        cls,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        language: str = "en",
    ) -> ChatResponse:
        """Deterministic chunk extraction fallback used when LLM is unavailable or offline."""
        return cls.synthesize_evidence_only(
            query=query,
            retrieved_chunks=retrieved_chunks,
            user_id=user_id,
            conversation_id=conversation_id,
        )

    @classmethod
    def synthesize(
        cls,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        language: str = "en",
    ) -> ChatResponse:
        """Synchronous synthesis fallback returning evidence-only response."""
        return cls.synthesize_evidence_only(
            query=query,
            retrieved_chunks=retrieved_chunks,
            user_id=user_id,
            conversation_id=conversation_id,
        )
