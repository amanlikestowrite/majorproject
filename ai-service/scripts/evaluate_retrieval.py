"""
Nyaya Sahayak — Comprehensive Retrieval Evaluation & Temporal Audit

Evaluates vector retrieval performance against the 8 validated golden sample chunks
plus Fast Track Special Courts (FTSCs), computing:
- Recall@1, Recall@3, Recall@5
- Mean Reciprocal Rank (MRR)
- Average retrieval latency
- Empty retrieval rate
- Classification: Exact source match vs Semantically related vs Incorrect
- Metadata and temporal filter validation (topic, information_type, data_as_of)
"""

import json
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

# Ground-truth test suite based on verified sample chunks and core DoJ domains
BENCHMARK_CASES = [
    {
        "domain": "Live-streaming rules",
        "query": "What matters are excluded from live streaming and what is the delay buffer under Model Rules?",
        "expected_chunk_id": "DOJ_STAT_RULE_LIVESTREAM_R005_R008_R009",
        "acceptable_chunk_ids": ["DOJ_STAT_RULE_LIVESTREAM_R005_COMPLETE", "DOJ_STAT_RULE_LIVESTREAM_R005_R008_R009"],
        "expected_topic": "Live-streaming rules",
    },
    {
        "domain": "eCourts & eFiling",
        "query": "What are the hardware, software, and registration requirements for eFiling 3.0?",
        "expected_chunk_id": "DOJ_STAT_PROC_EFILING_REGISTRATION",
        "acceptable_chunk_ids": ["DOJ_STAT_PROC_EFILING_REGISTRATION", "DOJ_STAT_GUIDE_EFILING_COMPLETE_PROCESS_GUIDE"],
        "expected_topic": "eCourts, eFiling, ePay, and case status",
    },
    {
        "domain": "Judicial Appointments (Parliament)",
        "query": "What was the reply to Lok Sabha Starred Question 35 regarding a Supreme Court bench in Kerala?",
        "expected_chunk_id": "DOJ_STAT_PARL_LS17_SQ035_SC_BENCH",
        "acceptable_chunk_ids": ["DOJ_STAT_PARL_LS17_SQ035_SC_BENCH"],
        "expected_topic": "Supreme Court and High Court appointments and vacancies",
    },
    {
        "domain": "Tele-Law Legal Aid",
        "query": "Who is eligible for free legal advice through Tele-Law under Section 12?",
        "expected_chunk_id": "DOJ_STAT_FAQ_TELELAW_PORTAL_CORE",
        "acceptable_chunk_ids": ["DOJ_STAT_FAQ_TELELAW_PORTAL_CORE", "DOJ_STAT_GUIDE_TELE_LAW_COMPLETE_GUIDE"],
        "expected_topic": "Tele-Law",
    },
    {
        "domain": "NJDG Pendency",
        "query": "What are the national pending case statistics and civil criminal case totals on NJDG?",
        "expected_chunk_id": "DOJ_DYN_STAT_NJDG_NATIONAL_20261108",
        "acceptable_chunk_ids": ["DOJ_DYN_STAT_NJDG_NATIONAL_20261108"],
        "expected_topic": "NJDG pendency statistics",
    },
    {
        "domain": "Judicial Vacancies Summary",
        "query": "What is the sanctioned and working strength of judges in Supreme Court and High Courts as of August 2026?",
        "expected_chunk_id": "DOJ_DYN_STAT_VACANCY_SC_HC_20260801",
        "acceptable_chunk_ids": ["DOJ_DYN_STAT_VACANCY_SC_HC_20260801", "DOJ_STAT_FAQ_0056"],
        "expected_topic": "Supreme Court and High Court appointments and vacancies",
    },
    {
        "domain": "High Court Vacancy Matrix",
        "query": "What is the sanctioned and working strength breakdown across all 25 High Courts?",
        "expected_chunk_id": "DOJ_DYN_TAB_HC_VACANCY_MATRIX_20260801",
        "acceptable_chunk_ids": ["DOJ_DYN_TAB_HC_VACANCY_MATRIX_20260801", "DOJ_DYN_STAT_VACANCY_SC_HC_20260801"],
        "expected_topic": "Supreme Court and High Court appointments and vacancies",
    },
    {
        "domain": "Virtual Courts Challan",
        "query": "How do virtual courts work and how do I search and pay my traffic challan online?",
        "expected_chunk_id": "DOJ_STAT_PROC_VCOURTS_FAQ_WORKFLOW",
        "acceptable_chunk_ids": ["DOJ_STAT_PROC_VCOURTS_FAQ_WORKFLOW", "DOJ_STAT_GUIDE_TRAFFIC_CHALLANS_AND_VCOURTS_GUIDE"],
        "expected_topic": "Virtual Courts and traffic challans",
    },
    {
        "domain": "Fast Track Special Courts",
        "query": "What are Fast Track Special Courts (FTSCs) under the Centrally Sponsored Scheme for POCSO cases?",
        "expected_chunk_id": "DOJ_STAT_FAQ_0055",
        "acceptable_chunk_ids": ["DOJ_STAT_FAQ_0055", "DOJ_STAT_PARL_LS17_UNST_1285_0008_QA"],
        "expected_topic": "Fast Track Special Courts",
    },
]


def run_retrieval_benchmark():
    """Execute retrieval evaluation across all benchmark cases."""
    retriever = KnowledgeRetriever()
    logger.info("Initializing Comprehensive Retrieval Evaluation (%d cases)...", len(BENCHMARK_CASES))

    total = len(BENCHMARK_CASES)
    hits_at_1 = 0
    hits_at_3 = 0
    hits_at_5 = 0
    reciprocal_ranks = []
    latencies = []
    empty_results = 0

    exact_matches = 0
    related_matches = 0
    incorrect_matches = 0

    results_table = []

    for idx, case in enumerate(BENCHMARK_CASES, 1):
        q = case["query"]
        expected_id = case["expected_chunk_id"]
        acceptable_ids = case["acceptable_chunk_ids"]
        expected_topic = case["expected_topic"]

        t0 = time.time()
        retrieved = retriever.retrieve(query=q, top_k=5)
        dt = (time.time() - t0) * 1000
        latencies.append(dt)

        if not retrieved:
            empty_results += 1
            incorrect_matches += 1
            reciprocal_ranks.append(0.0)
            logger.warning("Case %d: EMPTY RESULT for '%s'", idx, q)
            continue

        retrieved_ids = [r["chunk_id"] for r in retrieved]
        top_1_id = retrieved_ids[0]

        # Calculate Recall@k and RR
        rank = None
        for r_idx, cid in enumerate(retrieved_ids, 1):
            if cid in acceptable_ids:
                rank = r_idx
                break

        if rank == 1:
            hits_at_1 += 1
            hits_at_3 += 1
            hits_at_5 += 1
            reciprocal_ranks.append(1.0)
        elif rank and rank <= 3:
            hits_at_3 += 1
            hits_at_5 += 1
            reciprocal_ranks.append(1.0 / rank)
        elif rank and rank <= 5:
            hits_at_5 += 1
            reciprocal_ranks.append(1.0 / rank)
        else:
            reciprocal_ranks.append(0.0)

        # Classification
        if top_1_id == expected_id:
            classification = "Exact source retrieval"
            exact_matches += 1
        elif top_1_id in acceptable_ids or retrieved[0].get("topic") == expected_topic:
            classification = "Semantically related retrieval"
            related_matches += 1
        else:
            classification = "Incorrect retrieval"
            incorrect_matches += 1

        results_table.append({
            "case": idx,
            "domain": case["domain"],
            "query": q,
            "top_1_id": top_1_id,
            "top_1_score": retrieved[0]["score"],
            "expected_id": expected_id,
            "rank": rank,
            "latency_ms": dt,
            "classification": classification,
        })

    # Summary Metrics
    recall_1 = (hits_at_1 / total) * 100
    recall_3 = (hits_at_3 / total) * 100
    recall_5 = (hits_at_5 / total) * 100
    mrr = sum(reciprocal_ranks) / total
    avg_latency = sum(latencies) / len(latencies)
    empty_rate = (empty_results / total) * 100

    print("\n" + "=" * 90)
    print("PHASE 3 RETRIEVAL BENCHMARK EVALUATION RESULTS")
    print("=" * 90)
    print(f"Total Test Cases Evaluated : {total}")
    print(f"Recall@1                   : {recall_1:.1f}% ({hits_at_1}/{total})")
    print(f"Recall@3                   : {recall_3:.1f}% ({hits_at_3}/{total})")
    print(f"Recall@5                   : {recall_5:.1f}% ({hits_at_5}/{total})")
    print(f"Mean Reciprocal Rank (MRR) : {mrr:.4f}")
    print(f"Average Retrieval Latency  : {avg_latency:.2f} ms")
    print(f"Empty Retrieval Rate       : {empty_rate:.1f}% ({empty_results}/{total})")
    print("-" * 90)
    print(f"Exact Source Retrieval     : {exact_matches}/{total} ({(exact_matches/total)*100:.1f}%)")
    print(f"Semantically Related Match : {related_matches}/{total} ({(related_matches/total)*100:.1f}%)")
    print(f"Incorrect Retrieval        : {incorrect_matches}/{total} ({(incorrect_matches/total)*100:.1f}%)")
    print("=" * 90)

    for item in results_table:
        print(f"[{item['case']}] {item['domain']}")
        print(f"    Top Match: {item['top_1_id']} (Score: {item['top_1_score']:.4f}) | Rank: {item['rank']}")
        print(f"    Status: {item['classification']} | Latency: {item['latency_ms']:.1f}ms")

    return results_table


def run_metadata_and_temporal_validation():
    """Validate topic filtering, static/dynamic isolation, and temporal metadata currency."""
    retriever = KnowledgeRetriever()
    print("\n" + "=" * 90)
    print("PHASE 4 METADATA AND TEMPORAL VALIDATION")
    print("=" * 90)

    # 1. Topic Filter Test
    topic_query = "court proceedings"
    filtered_topic = "Live-streaming rules"
    topic_results = retriever.retrieve(query=topic_query, top_k=5, topic=filtered_topic)
    assert len(topic_results) > 0, "Topic filter returned 0 results"
    for r in topic_results:
        assert r["topic"] == filtered_topic, f"Topic leakage! Expected {filtered_topic}, got {r['topic']}"
    print(f"1. Topic Filter Check: PASSED (All {len(topic_results)} results match topic '{filtered_topic}')")

    # 2. Information Type: Static Filter
    static_results = retriever.retrieve(query="judge appointment procedure", top_k=5, information_type="static")
    assert len(static_results) > 0, "Static filter returned 0 results"
    for r in static_results:
        assert r["information_type"] == "static", f"Static leakage! Got {r['information_type']}"
    print(f"2. Static Filter Check: PASSED (All {len(static_results)} results have information_type='static')")

    # 3. Information Type: Dynamic Filter
    dynamic_results = retriever.retrieve(query="pending cases statistics", top_k=5, information_type="dynamic")
    assert len(dynamic_results) > 0, "Dynamic filter returned 0 results"
    for r in dynamic_results:
        assert r["information_type"] == "dynamic", f"Dynamic leakage! Got {r['information_type']}"
        assert r.get("data_as_of") is not None, f"Dynamic chunk {r['chunk_id']} missing data_as_of!"
    print(f"3. Dynamic Filter Check: PASSED (All {len(dynamic_results)} results have information_type='dynamic')")

    # 4. Temporal Currency Validation
    njdg_results = retriever.retrieve(query="NJDG national pending case statistics", top_k=1, information_type="dynamic")
    assert len(njdg_results) > 0
    top_njdg = njdg_results[0]
    print(f"4. Temporal Currency Check: Top NJDG chunk {top_njdg['chunk_id']}")
    print(f"   - Publication Date: {top_njdg.get('publication_date')}")
    print(f"   - Data As Of: {top_njdg.get('data_as_of')}")
    print(f"   - Is Point in Time: {top_njdg.get('is_point_in_time')}")
    assert top_njdg.get("data_as_of") == "2026-11-08", f"Unexpected data_as_of: {top_njdg.get('data_as_of')}"
    print("   - Temporal Verification: PASSED (Exact verified snapshot 2026-11-08)")

    print("=" * 90)
    print("ALL METADATA & TEMPORAL AUDITS PASSED 100%!")
    print("=" * 90)


if __name__ == "__main__":
    run_retrieval_benchmark()
    run_metadata_and_temporal_validation()
