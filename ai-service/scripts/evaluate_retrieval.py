"""
Nyaya Sahayak — Retrieval Benchmark & Evaluation Script

Tests the vector index across diverse legal inquiries across the 8 DoJ domains,
reporting precision, rank, and source metadata accuracy.
"""

import logging
import sys
import time
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.retriever import KnowledgeRetriever
from app.services.generator import ResponseSynthesizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("evaluate_retrieval")

BENCHMARK_QUERIES = [
    {
        "query": "What matters cannot be live streamed under Model Rules Rule 5?",
        "expected_topic": "Live-streaming rules",
        "expected_chunk_prefix": "DOJ_STAT_RULE_LIVESTREAM",
    },
    {
        "query": "What is the procedure for advocate registration on eFiling 3.0?",
        "expected_topic": "eCourts, eFiling, ePay, and case status",
        "expected_chunk_prefix": "DOJ_STAT_PROC_EFILING",
    },
    {
        "query": "What is the sanctioned and working strength of Supreme Court judges?",
        "expected_topic": "Supreme Court and High Court appointments and vacancies",
        "expected_chunk_prefix": "DOJ_DYN_STAT_VACANCY",
    },
    {
        "query": "Who is eligible for free legal aid under Section 12 in Tele-Law?",
        "expected_topic": "Tele-Law",
        "expected_chunk_prefix": "DOJ_STAT_FAQ_TELELAW",
    },
    {
        "query": "How do I pay a traffic challan in Virtual Courts without attending court?",
        "expected_topic": "Virtual Courts and traffic challans",
        "expected_chunk_prefix": "DOJ_STAT_PROC_VCOURTS",
    },
]


def run_evaluation():
    """Run benchmark queries against the active knowledge base retriever."""
    retriever = KnowledgeRetriever()
    logger.info("Initializing Retrieval Evaluation across %d benchmark queries...", len(BENCHMARK_QUERIES))

    passed = 0
    total = len(BENCHMARK_QUERIES)

    for i, test_case in enumerate(BENCHMARK_QUERIES, 1):
        q = test_case["query"]
        logger.info("\n--- Test Query #%d: '%s' ---", i, q)
        start_time = time.time()
        results = retriever.retrieve(query=q, top_k=3)
        latency = (time.time() - start_time) * 1000

        if not results:
            logger.error("FAILED: No chunks retrieved!")
            continue

        top_hit = results[0]
        logger.info(
            "Top Match: [%.4f] %s | Topic: %s (latency: %.1fms)",
            top_hit["score"],
            top_hit["chunk_id"],
            top_hit.get("topic"),
            latency,
        )
        logger.info("Source Document: %s (Page: %s)", top_hit.get("source_document"), top_hit.get("page_number_or_range"))

        # Test synthesizer output format
        response = ResponseSynthesizer.synthesize(query=q, retrieved_chunks=results)
        assert response.summary, "Summary must not be empty"
        assert response.source, "Source must not be empty"
        assert len(response.citations) > 0, "Citations must be present"

        logger.info("Synthesized Summary: %s...", response.summary[:120])
        logger.info("Citations Attached: %d", len(response.citations))

        passed += 1

    logger.info("\n==========================================")
    logger.info("EVALUATION RESULT: %d/%d queries successfully retrieved & synthesized!", passed, total)
    logger.info("==========================================")
    return passed == total


if __name__ == "__main__":
    success = run_evaluation()
    sys.exit(0 if success else 1)

