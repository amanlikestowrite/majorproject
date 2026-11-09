"""
Nyaya Sahayak — Tests for Response Synthesis Service & Gemini Integration
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.generator import ResponseSynthesizer


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


def test_deterministic_empty_chunks():
    res = ResponseSynthesizer.synthesize_deterministic(
        query="Random unindexed question",
        retrieved_chunks=[],
        user_id="user-123",
        conversation_id="conv-456",
    )
    assert res.userId == "user-123"
    assert res.conversationId == "conv-456"
    assert "No matching official record was located" in res.summary
    assert res.portal.domain == "doj.gov.in"
    assert len(res.citations) == 0


def test_deterministic_with_chunks(sample_chunks):
    res = ResponseSynthesizer.synthesize_deterministic(
        query="What cases cannot be live streamed?",
        retrieved_chunks=sample_chunks,
        user_id="user-123",
    )
    assert len(res.citations) == 1
    assert res.citations[0].chunk_id == "DOJ_STAT_RULE_LIVESTREAM_R005"
    assert len(res.steps) >= 1
    assert "Matrimonial matters" in res.steps[0]
    assert res.portal is not None


@pytest.mark.asyncio
async def test_gemini_synthesis_success(sample_chunks):
    mock_gemini_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": (
                                '{\n'
                                '  "summary": "Under Rule 5.2 of the Model Rules, specific sensitive matters are prohibited from live streaming.",\n'
                                '  "steps": ["Matrimonial and custody disputes are excluded.", "Sexual offenses and POCSO cases are excluded."],\n'
                                '  "important": "Statutory notice: unauthorized recording is punishable under law.",\n'
                                '  "followUps": ["What are the penalties for unauthorized recording?"]\n'
                                '}'
                            )
                        }
                    ]
                }
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = MagicMock(return_value=mock_gemini_response)

    with patch("app.services.generator.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        
        mock_settings.return_value.gemini_api_key = "fake-key"
        mock_settings.return_value.gemini_model_name = "gemini-2.5-flash"
        mock_settings.return_value.gemini_temperature = 0.2
        mock_settings.return_value.gemini_max_output_tokens = 1024
        mock_settings.return_value.gemini_timeout_seconds = 15.0
        mock_post.return_value = mock_response

        res = await ResponseSynthesizer.synthesize_with_gemini(
            query="What proceedings cannot be live streamed?",
            retrieved_chunks=sample_chunks,
            user_id="test-user",
            conversation_id="test-conv",
        )

        assert res.userId == "test-user"
        assert res.conversationId == "test-conv"
        assert "Rule 5.2" in res.summary
        assert len(res.steps) == 2
        assert len(res.citations) == 1
        assert res.citations[0].chunk_id == "DOJ_STAT_RULE_LIVESTREAM_R005"


@pytest.mark.asyncio
async def test_gemini_synthesis_fallback_on_error(sample_chunks):
    with patch("app.services.generator.get_settings") as mock_settings, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        
        mock_settings.return_value.gemini_api_key = "fake-key"
        mock_settings.return_value.gemini_model_name = "gemini-2.5-flash"
        mock_settings.return_value.gemini_temperature = 0.2
        mock_settings.return_value.gemini_max_output_tokens = 1024
        mock_settings.return_value.gemini_timeout_seconds = 15.0
        mock_post.side_effect = RuntimeError("Network timeout")

        res = await ResponseSynthesizer.synthesize_with_gemini(
            query="What proceedings cannot be live streamed?",
            retrieved_chunks=sample_chunks,
            user_id="test-user",
        )

        # Successfully falls back to deterministic synthesis
        assert res.userId == "test-user"
        assert len(res.citations) == 1
        assert res.citations[0].chunk_id == "DOJ_STAT_RULE_LIVESTREAM_R005"
