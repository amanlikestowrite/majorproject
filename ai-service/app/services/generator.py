"""
Nyaya Sahayak — Response Synthesis Service

Constructs structured legal assistance responses conforming to the presentation
contract expected by the frontend assistant card renderer, backed by verifiable citations.
Supports both LLM-grounded generation via Google Gemini and deterministic fallback synthesis.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

from app.config import get_settings
from app.models.response import (
    AuditMetadata,
    ChatResponse,
    Citation,
    PortalInfo,
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
        # Match numbered lists or bullet points
        if stripped.startswith(("- ", "* ", "1. ", "2. ", "3. ", "4. ", "5. ", "6. ")):
            cleaned = stripped.lstrip("-*0123456789. ")
            if len(cleaned) > 10 and not cleaned.startswith("#"):
                steps.append(cleaned)
        if len(steps) >= 4:
            break

    # If markdown lacked numbered lists, extract key informative paragraphs
    if not steps:
        paragraphs = [p.strip() for p in content.split("\n\n") if len(p.strip()) > 30 and not p.strip().startswith("#")]
        steps = paragraphs[:3]

    return steps


def build_citations_from_chunks(chunks: List[Dict[str, Any]]) -> List[Citation]:
    """Construct a list of Citation models from retrieved chunks."""
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
            )
        )
    return citations


class ResponseSynthesizer:
    """Transforms retrieved knowledge chunks into citation-backed frontend cards."""

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
        if not retrieved_chunks:
            portal = CANONICAL_PORTALS["doj"]
            return ChatResponse(
                userId=user_id,
                conversationId=conversation_id,
                summary="Nyaya Sahayak is ready to guide you on Department of Justice initiatives, court procedures, case status, eFiling, and judicial vacancies. No matching official record was located for this specific query.",
                steps=[
                    "Check if your inquiry relates to Case Status, Traffic Challans, eFiling, Free Legal Aid, or Judicial Appointments.",
                    "Verify the CNR number or specific procedural category and query again.",
                    "For certified court orders and judicial filings, refer directly to official court portals.",
                ],
                important="Nyaya Sahayak provides administrative and procedural guidance and does not provide legal representation.",
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
            )

        primary = retrieved_chunks[0]
        topic = primary.get("topic", "Department of Justice")
        primary_content = primary.get("source_content") or primary.get("content", "")

        citations = build_citations_from_chunks(retrieved_chunks)
        steps = extract_procedural_steps(primary_content)

        paragraphs = [p.strip() for p in primary_content.split("\n\n") if len(p.strip()) > 20 and not p.strip().startswith("#")]
        summary = paragraphs[0] if paragraphs else primary_content[:300]

        important = None
        if primary.get("audit_notes"):
            important = f"Official Audit Note: {primary['audit_notes']}"
        elif "rule" in primary.get("content_type", "").lower() or "livestream" in primary["chunk_id"].lower():
            important = "Statutory Notice: All court proceeding recordings and live streams are protected under the Copyright Act, 1957 and IT Act, 2000. Unauthorized capture or sharing is strictly prohibited."
        elif primary.get("information_type") == "dynamic":
            as_of = primary.get("data_as_of", "publication date")
            important = f"Point-in-Time Statistic: This metric reflects official data as of {as_of}. Real-time statistics are updated monthly by the Department of Justice."

        portal = resolve_portal_for_topic(topic, primary.get("source_url"))

        doc_name = primary.get("source_document", "Department of Justice")
        page_info = f" (Page {primary.get('page_number_or_range')})" if primary.get("page_number_or_range") else ""
        as_of_info = f" [Data as of {primary.get('data_as_of')}]" if primary.get("data_as_of") else ""
        source_stmt = f"{doc_name}{page_info}{as_of_info} — Ministry of Law & Justice, Govt. of India"

        follow_ups = [
            f"Where can I find certified records for {topic}?",
            "What is the official procedure on the government portal?",
        ]
        if "vacancy" in topic.lower():
            follow_ups = [
                "What is the sanctioned judge strength in the Supreme Court?",
                "How many permanent judge vacancies exist in High Courts?",
                "What is the Memorandum of Procedure (MoP) for judge appointments?",
            ]
        elif "live-stream" in topic.lower():
            follow_ups = [
                "What proceedings are strictly excluded from live streaming?",
                "What is the statutory delay buffer under Rule 8.3?",
                "What are the penalties for unauthorized recording under Rule 9?",
            ]
        elif "tele-law" in topic.lower():
            follow_ups = [
                "Who is eligible for free legal advice under Section 12?",
                "How can I book an appointment with a panel lawyer via CSC?",
                "Is Tele-Law available through a mobile application?",
            ]

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
            followUps=follow_ups,
            citations=citations,
            audit=audit,
        )

    @classmethod
    async def synthesize_with_gemini(
        cls,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        language: str = "en",
    ) -> ChatResponse:
        """Call Google Gemini 2.5 API with strict source grounding to synthesize response."""
        settings = get_settings()
        api_key = settings.gemini_api_key
        if not api_key:
            return cls.synthesize_deterministic(query, retrieved_chunks, user_id, conversation_id, language)

        primary = retrieved_chunks[0]
        topic = primary.get("topic", "Department of Justice")
        portal = resolve_portal_for_topic(topic, primary.get("source_url"))
        citations = build_citations_from_chunks(retrieved_chunks)

        # Build context from chunks
        context_blocks = []
        for i, chunk in enumerate(retrieved_chunks, 1):
            cid = chunk.get("chunk_id", f"CHUNK_{i}")
            doc = chunk.get("source_document", "Official Document")
            content = chunk.get("source_content") or chunk.get("content", "")
            context_blocks.append(f"[{cid}] (Document: {doc})\n{content}")

        context_str = "\n\n---\n\n".join(context_blocks)

        system_instruction = (
            "You are Nyaya Sahayak, the Department of Justice AI assistant (Ministry of Law & Justice, Govt. of India). "
            "Your role is to provide accurate, procedural, and administrative guidance based strictly on the verified "
            "official context chunks provided below.\n\n"
            "STRICT GROUNDING RULES:\n"
            "1. You must ONLY answer using factual statements directly verifiable from the provided source chunks.\n"
            "2. Never hallucinate, extrapolate, or invent legal provisions, statistics, vacancy counts, or procedures.\n"
            "3. If the context does not contain enough information, state that clearly.\n"
            "4. Respond in valid JSON adhering to the specified schema without preamble or markdown wraps outside the JSON.\n"
            "5. Language target: " + language + ".\n"
        )

        user_prompt = (
            f"Citizen Question: {query}\n\n"
            f"Verified Official Source Chunks:\n{context_str}\n\n"
            "Format your response as a valid JSON object with the following keys:\n"
            '{\n'
            '  "summary": "Clear, direct 2-3 sentence answer to the citizen (HTML <strong> tags allowed for key terms)",\n'
            '  "steps": ["Step or key takeaway 1", "Step or key takeaway 2", ...],\n'
            '  "important": "Statutory warning, point-in-time statistic note, or disclaimer (or null)",\n'
            '  "followUps": ["Relevant follow-up question 1", "Relevant follow-up question 2", ...]\n'
            '}'
        )

        gemini_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_model_name}:generateContent?key={api_key}"
        )

        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": [
                {
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": settings.gemini_temperature,
                "maxOutputTokens": settings.gemini_max_output_tokens,
                "responseMimeType": "application/json",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=settings.gemini_timeout_seconds) as client:
                res = await client.post(gemini_url, json=payload)
                res.raise_for_status()
                data = res.json()

            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("No candidates returned from Gemini API")

            raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
            parsed = json.loads(raw_text)

            summary = parsed.get("summary") or "Grounded legal guidance based on Department of Justice records."
            steps = parsed.get("steps") or extract_procedural_steps(primary.get("source_content", ""))
            important = parsed.get("important")
            follow_ups = parsed.get("followUps") or [
                f"Where can I find certified records for {topic}?",
                "What is the official procedure on the government portal?",
            ]

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
                followUps=follow_ups,
                citations=citations,
                audit=audit,
            )

        except Exception as exc:
            logger.warning(
                "Gemini generation failed or timed out (%s); falling back to deterministic synthesis.",
                exc,
            )
            return cls.synthesize_deterministic(query, retrieved_chunks, user_id, conversation_id, language)

    @classmethod
    async def synthesize_async(
        cls,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        language: str = "en",
    ) -> ChatResponse:
        """Asynchronous synthesis entrypoint dynamically selecting Gemini or deterministic fallback."""
        if not retrieved_chunks:
            return cls.synthesize_deterministic(query, [], user_id, conversation_id, language)

        settings = get_settings()
        if settings.gemini_api_key:
            return await cls.synthesize_with_gemini(
                query=query,
                retrieved_chunks=retrieved_chunks,
                user_id=user_id,
                conversation_id=conversation_id,
                language=language,
            )

        return cls.synthesize_deterministic(
            query=query,
            retrieved_chunks=retrieved_chunks,
            user_id=user_id,
            conversation_id=conversation_id,
            language=language,
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
        """Synchronous synthesis interface for backward compatibility."""
        return cls.synthesize_deterministic(
            query=query,
            retrieved_chunks=retrieved_chunks,
            user_id=user_id,
            conversation_id=conversation_id,
            language=language,
        )
