"""
Nyaya Sahayak — Tests for Response Synthesis Service & Evidence-Only Fallback
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.generator import ResponseSynthesizer
from app.services.providers.gemini_provider import GeminiProvider


@pytest.fixture
def sample_chunks():
    return [
        {
            "chunk_id": "DOJ_STAT_RULE_LIVESTREAM_R005",
            "source_document": "Model Rules for Live-Streaming and Recording of Court Proceedings",
            "page_number_or_range": "3-5",
            "source_url": "https://doj.gov.in/rules-livestreaming",
            "fidelity_classification": "verbatim",
            "data_as_of": "2021-06-01",
            "publication_date": "2021-06-01",
            "information_type": "static",
            "topic": "Live-streaming rules",
            "source_content": (
                "Rule 5.1: Live streaming shall be allowed for all court proceedings.\n"
                "Rule 5.2: The following matters are strictly excluded:\n"
                "1. Matrimonial matters and child custody disputes.\n"
                "2. Sexual offenses and gender-based violence cases.\n"
                "3. Matters involving national security and public order."
            ),
        }
    ]


def test_evidence_only_empty_chunks():
    res = ResponseSynthesizer.synthesize_evidence_only(
        query="Random unindexed question",
        retrieved_chunks=[],
        user_id="user-123",
        conversation_id="conv-456",
    )
    assert res.userId == "user-123"
    assert res.conversationId == "conv-456"
    assert "No matching official Department of Justice record was located" in res.summary
    assert res.generation_status == "abstained_insufficient_evidence"
    assert res.provider == "none"
    assert len(res.citations) == 0


def test_evidence_only_with_chunks(sample_chunks):
    res = ResponseSynthesizer.synthesize_evidence_only(
        query="What cases cannot be live streamed?",
        retrieved_chunks=sample_chunks,
        user_id="user-123",
        failure_reason="Test Provider Failure",
    )
    assert res.generation_status == "evidence_only"
    assert res.provider == "none"
    assert "Test Provider Failure" in res.summary
    assert "AI synthesis was not performed" in res.summary
    assert len(res.citations) == 1
    assert res.citations[0].chunk_id == "DOJ_STAT_RULE_LIVESTREAM_R005"
    assert len(res.steps) >= 1
    assert "Matrimonial matters" in res.steps[0]
    assert res.portal is not None


@pytest.mark.asyncio
async def test_synthesize_async_provider_fallback_when_unconfigured(sample_chunks):
    """When API key is not configured, synthesize_async returns labelled evidence-only response."""
    with patch("app.services.generator.get_settings") as mock_settings:
        mock_settings.return_value.gemini_api_key = None
        mock_settings.return_value.gemini_model_name = "gemini-2.5-flash"
        mock_settings.return_value.gemini_temperature = 0.2
        mock_settings.return_value.gemini_max_output_tokens = 1024
        mock_settings.return_value.gemini_timeout_seconds = 15.0

        res = await ResponseSynthesizer.synthesize_async(
            query="What cases cannot be live streamed?",
            retrieved_chunks=sample_chunks,
            user_id="test-user",
        )

        assert res.generation_status == "evidence_only"
        assert res.provider == "none"
        assert "Gemini API key is not configured" in res.summary
        assert len(res.citations) == 1
        assert res.citations[0].chunk_id == "DOJ_STAT_RULE_LIVESTREAM_R005"
