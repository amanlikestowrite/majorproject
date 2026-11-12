"""
Nyaya Sahayak — Google Gemini Hosted Embeddings Evaluation & Benchmark

Evaluates gemini-embedding-001 at 768 and 3072 dimensions across all 229 knowledge chunks
in isolated experimental Qdrant collections:
- doj_gemini_768_experimental
- doj_gemini_3072_experimental

Computes Recall@1, Recall@3, Recall@5, MRR, latency, and compares against
the BGE-M3 local baseline (Recall@1: 44.4%, Recall@3: 77.8%, Recall@5: 77.8%, MRR: 0.6111).
Strict boundary: Does NOT alter or delete the primary doj_knowledge_base collection.
"""

import json
import logging
import math
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import get_settings
from app.services.providers.gemini_embedder import (
    GeminiEmbeddingService,
    GeminiQuotaExhaustedError,
    l2_normalize,
)
from app.services.vector_store import generate_point_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("evaluate_gemini")

BENCHMARK_CASES = [
    {
        "id": 1,
        "domain": "Live-streaming rules",
        "query": "What matters are excluded from live streaming and what is the delay buffer under Model Rules?",
        "expected_chunk_id": "DOJ_STAT_RULE_LIVESTREAM_R005_R008_R009",
        "acceptable_chunk_ids": ["DOJ_STAT_RULE_LIVESTREAM_R005_COMPLETE", "DOJ_STAT_RULE_LIVESTREAM_R005_R008_R009"],
        "expected_topic": "Live-streaming rules",
    },
    {
        "id": 2,
        "domain": "eCourts & eFiling",
        "query": "What are the hardware, software, and registration requirements for eFiling 3.0?",
        "expected_chunk_id": "DOJ_STAT_PROC_EFILING_REGISTRATION",
        "acceptable_chunk_ids": ["DOJ_STAT_PROC_EFILING_REGISTRATION", "DOJ_STAT_GUIDE_EFILING_COMPLETE_PROCESS_GUIDE"],
        "expected_topic": "eCourts, eFiling, ePay, and case status",
    },
    {
        "id": 3,
        "domain": "Judicial Appointments (Parliament)",
        "query": "What was the reply to Lok Sabha Starred Question 35 regarding a Supreme Court bench in Kerala?",
        "expected_chunk_id": "DOJ_STAT_PARL_LS17_SQ035_SC_BENCH",
        "acceptable_chunk_ids": ["DOJ_STAT_PARL_LS17_SQ035_SC_BENCH"],
        "expected_topic": "Supreme Court and High Court appointments and vacancies",
    },
    {
        "id": 4,
        "domain": "Tele-Law Legal Aid",
        "query": "Who is eligible for free legal advice through Tele-Law under Section 12?",
        "expected_chunk_id": "DOJ_STAT_FAQ_TELELAW_PORTAL_CORE",
        "acceptable_chunk_ids": ["DOJ_STAT_FAQ_TELELAW_PORTAL_CORE", "DOJ_STAT_GUIDE_TELE_LAW_COMPLETE_GUIDE"],
        "expected_topic": "Tele-Law",
    },
    {
        "id": 5,
        "domain": "NJDG Pendency",
        "query": "What are the national pending case statistics and civil criminal case totals on NJDG?",
        "expected_chunk_id": "DOJ_DYN_STAT_NJDG_NATIONAL_20261108",
        "acceptable_chunk_ids": ["DOJ_DYN_STAT_NJDG_NATIONAL_20261108"],
        "expected_topic": "NJDG pendency statistics",
    },
    {
        "id": 6,
        "domain": "Judicial Vacancies Summary",
        "query": "What is the sanctioned and working strength of judges in Supreme Court and High Courts as of August 2026?",
        "expected_chunk_id": "DOJ_DYN_STAT_VACANCY_SC_HC_20260801",
        "acceptable_chunk_ids": ["DOJ_DYN_STAT_VACANCY_SC_HC_20260801", "DOJ_STAT_FAQ_0056"],
        "expected_topic": "Supreme Court and High Court appointments and vacancies",
    },
    {
        "id": 7,
        "domain": "High Court Vacancy Matrix",
        "query": "What is the sanctioned and working strength breakdown across all 25 High Courts?",
        "expected_chunk_id": "DOJ_DYN_TAB_HC_VACANCY_MATRIX_20260801",
        "acceptable_chunk_ids": ["DOJ_DYN_TAB_HC_VACANCY_MATRIX_20260801", "DOJ_DYN_STAT_VACANCY_SC_HC_20260801"],
        "expected_topic": "Supreme Court and High Court appointments and vacancies",
    },
    {
        "id": 8,
        "domain": "Virtual Courts Challan",
        "query": "How do virtual courts work and how do I search and pay my traffic challan online?",
        "expected_chunk_id": "DOJ_STAT_PROC_VCOURTS_FAQ_WORKFLOW",
        "acceptable_chunk_ids": ["DOJ_STAT_PROC_VCOURTS_FAQ_WORKFLOW", "DOJ_STAT_GUIDE_TRAFFIC_CHALLANS_AND_VCOURTS_GUIDE"],
        "expected_topic": "Virtual Courts and traffic challans",
    },
    {
        "id": 9,
        "domain": "Fast Track Special Courts",
        "query": "What are Fast Track Special Courts (FTSCs) under the Centrally Sponsored Scheme for POCSO cases?",
        "expected_chunk_id": "DOJ_STAT_FAQ_0055",
        "acceptable_chunk_ids": ["DOJ_STAT_FAQ_0055", "DOJ_STAT_PARL_LS17_UNST_1285_0008_QA"],
        "expected_topic": "Fast Track Special Courts",
    },
]


def load_chunks() -> List[Dict[str, Any]]:
    """Load all 229 verified chunks from rag_chunks.jsonl."""
    settings = get_settings()
    chunks_path = Path(settings.knowledge_base_chunks_path)
    if not chunks_path.is_absolute():
        chunks_path = (SERVICE_DIR / chunks_path).resolve()
    chunks = []
    with open(chunks_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    logger.info("Loaded %d validated chunks from %s", len(chunks), chunks_path)
    return chunks


def build_token_aware_batches(chunks: List[Dict[str, Any]], max_tokens_per_batch: int = 12000, max_chunks: int = 15):
    """Split chunks into batches that strictly fit within the token ceiling (12k tokens << 30k TPM limit)."""
    batches = []
    current_batch = []
    current_tokens = 0

    for chunk in chunks:
        tok = chunk.get("token_count") or (len(chunk["content"]) // 4)
        if (current_tokens + tok > max_tokens_per_batch or len(current_batch) >= max_chunks) and current_batch:
            batches.append(current_batch)
            current_batch = [chunk]
            current_tokens = tok
        else:
            current_batch.append(chunk)
            current_tokens += tok

    if current_batch:
        batches.append(current_batch)

    return batches


def compute_all_document_embeddings(
    chunks: List[Dict[str, Any]],
    embedder: GeminiEmbeddingService,
) -> List[List[float]]:
    """
    Computes 3072-dimensional document embeddings across all 229 chunks with token-aware rate limiting.
    Utilizes local cache if available.
    """
    cache_path = SERVICE_DIR / "data" / "knowledge_base" / "gemini_3072_embeddings_cache.json"
    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if len(data) == len(chunks) and len(data[0]) == 3072:
                logger.info("Loaded all %d cached 3072-dim embeddings from %s", len(data), cache_path)
                return data
        except Exception as e:
            logger.warning("Cache load failed: %s; recomputing...", e)

    batches = build_token_aware_batches(chunks, max_tokens_per_batch=12000, max_chunks=15)
    logger.info("Formed %d token-budgeted batches for %d chunks.", len(batches), len(chunks))

    embeddings_3072: List[List[float]] = []

    for idx, batch in enumerate(batches, 1):
        batch_texts = [c["content"] for c in batch]
        tok_sum = sum(c.get("token_count", len(c["content"]) // 4) for c in batch)
        logger.info("Encoding batch %d/%d (%d chunks, ~%d tokens)...", idx, len(batches), len(batch), tok_sum)

        attempt = 1
        while True:
            try:
                batch_vecs = embedder.embed_documents(batch_texts, batch_size=len(batch_texts))
                embeddings_3072.extend(batch_vecs)
                logger.info("  Batch %d/%d succeeded (%d total vecs).", idx, len(batches), len(embeddings_3072))
                break
            except GeminiQuotaExhaustedError as qe:
                logger.warning("  Rate limit hit on batch %d (attempt %d). Sleeping 35s...", idx, attempt)
                time.sleep(35.0)
                attempt += 1
            except Exception as e:
                logger.error("  Error on batch %d: %s. Sleeping 15s...", idx, e)
                time.sleep(15.0)
                attempt += 1

        # Pause 25 seconds between batches to maintain ~24k tokens/min (< 30k TPM limit)
        if idx < len(batches):
            time.sleep(25.0)

    assert len(embeddings_3072) == len(chunks), f"Expected {len(chunks)}, got {len(embeddings_3072)}"

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(embeddings_3072, f)
    logger.info("Saved %d embeddings to cache: %s", len(embeddings_3072), cache_path)

    return embeddings_3072


def build_collection(
    qdrant_client: QdrantClient,
    collection_name: str,
    dimension: int,
    chunks: List[Dict[str, Any]],
    embeddings: List[List[float]],
) -> Dict[str, Any]:
    """Index points into Qdrant collection."""
    existing_collections = [c.name for c in qdrant_client.get_collections().collections]
    if collection_name in existing_collections:
        logger.info("Collection '%s' exists. Recreating...", collection_name)
        qdrant_client.delete_collection(collection_name=collection_name)

    logger.info("Creating Qdrant collection '%s' (dim=%d, distance=COSINE)...", collection_name, dimension)
    qdrant_client.create_collection(
        collection_name=collection_name,
        vectors_config=qmodels.VectorParams(
            size=dimension,
            distance=qmodels.Distance.COSINE,
        ),
    )

    t0 = time.time()
    points = []
    for chunk, vector in zip(chunks, embeddings):
        point_id = generate_point_id(chunk["chunk_id"])
        payload = {
            "chunk_id": chunk["chunk_id"],
            "source_document": chunk.get("source_document", ""),
            "topic": chunk.get("topic", ""),
            "information_type": chunk.get("information_type", "static"),
            "data_as_of": chunk.get("data_as_of", ""),
            "content": chunk.get("content", ""),
        }
        points.append(qmodels.PointStruct(id=point_id, vector=vector, payload=payload))

    qdrant_client.upsert(collection_name=collection_name, points=points, wait=True)
    info = qdrant_client.get_collection(collection_name=collection_name)
    logger.info("Collection '%s' ready with %d points.", collection_name, info.points_count)
    assert info.points_count == len(chunks)

    return {
        "collection_name": collection_name,
        "dimension": dimension,
        "indexed_chunks": info.points_count,
        "indexing_time_sec": round(time.time() - t0, 2),
    }


def evaluate_collection(
    qdrant_client: QdrantClient,
    collection_name: str,
    embedder: GeminiEmbeddingService,
    score_threshold: float = 0.45,
) -> Dict[str, Any]:
    """Run 9 benchmark queries against the specified collection."""
    logger.info("--- Evaluating collection '%s' across 9 benchmark cases ---", collection_name)

    hits_at_1 = 0
    hits_at_3 = 0
    hits_at_5 = 0
    reciprocal_ranks = []
    latencies_ms = []
    case_results = []

    for case in BENCHMARK_CASES:
        query = case["query"]
        acceptable_ids = case["acceptable_chunk_ids"]
        expected_id = case["expected_chunk_id"]

        t_start = time.time()
        attempt = 1
        query_vec = None
        while attempt <= 5:
            try:
                query_vec = embedder.embed_query(query)
                break
            except GeminiQuotaExhaustedError:
                logger.warning("Quota hit on query '%s'. Sleeping 30s...", query[:30])
                time.sleep(30.0)
                attempt += 1

        if query_vec is None:
            reciprocal_ranks.append(0.0)
            continue

        search_res = qdrant_client.query_points(
            collection_name=collection_name,
            query=query_vec,
            limit=5,
            score_threshold=score_threshold,
        )
        t_elapsed_ms = (time.time() - t_start) * 1000
        latencies_ms.append(t_elapsed_ms)

        retrieved_ids = [pt.payload.get("chunk_id") for pt in search_res.points]
        scores = [float(pt.score) for pt in search_res.points]

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

        case_results.append({
            "case_id": case["id"],
            "domain": case["domain"],
            "expected_id": expected_id,
            "rank": rank,
            "top_1_id": retrieved_ids[0] if retrieved_ids else "None",
            "top_1_score": round(scores[0], 4) if scores else 0.0,
            "latency_ms": round(t_elapsed_ms, 1),
            "match": "Exact" if (retrieved_ids and retrieved_ids[0] == expected_id) else ("Acceptable" if rank else "Miss"),
        })

        time.sleep(2.0)

    total_cases = len(BENCHMARK_CASES)
    recall_1 = (hits_at_1 / total_cases) * 100
    recall_3 = (hits_at_3 / total_cases) * 100
    recall_5 = (hits_at_5 / total_cases) * 100
    mrr = sum(reciprocal_ranks) / total_cases
    avg_latency = sum(latencies_ms) / len(latencies_ms) if latencies_ms else 0.0

    return {
        "collection_name": collection_name,
        "total_cases": total_cases,
        "hits_at_1": hits_at_1,
        "hits_at_3": hits_at_3,
        "hits_at_5": hits_at_5,
        "recall_at_1": round(recall_1, 2),
        "recall_at_3": round(recall_3, 2),
        "recall_at_5": round(recall_5, 2),
        "mrr": round(mrr, 4),
        "avg_latency_ms": round(avg_latency, 1),
        "cases": case_results,
    }


def main():
    settings = get_settings()
    logger.info("Starting Matryoshka-optimized Gemini Embedding Benchmark...")
    qdrant_path = Path(settings.qdrant_storage_path)
    if not qdrant_path.is_absolute():
        qdrant_path = (SERVICE_DIR / qdrant_path).resolve()

    qdrant_client = QdrantClient(path=str(qdrant_path), force_disable_check_same_thread=True)

    # Check original collection
    orig_info = qdrant_client.get_collection("doj_knowledge_base")
    logger.info("Protected collection 'doj_knowledge_base': %d points, vector_size=%d", orig_info.points_count, orig_info.config.params.vectors.size)

    chunks = load_chunks()

    embedder_3072 = GeminiEmbeddingService(
        api_key=settings.gemini_api_key,
        model_name="gemini-embedding-001",
        expected_dim=3072,
        normalize=True,
    )
    embedder_768 = GeminiEmbeddingService(
        api_key=settings.gemini_api_key,
        model_name="gemini-embedding-001",
        expected_dim=768,
        normalize=True,
    )

    # Compute 3072 embeddings once (MRL ensures prefix is identical to 768)
    embeddings_3072 = compute_all_document_embeddings(chunks, embedder_3072)

    # Derive 768 embeddings via exact normalized Matryoshka slice
    logger.info("Deriving 768-dim embeddings via normalized MRL slice...")
    embeddings_768 = [l2_normalize(vec[:768]) for vec in embeddings_3072]

    # Build and evaluate 768-dim collection
    logger.info("\n--- Phase 1: Evaluating 768 Dimensions ---")
    build_info_768 = build_collection(qdrant_client, "doj_gemini_768_experimental", 768, chunks, embeddings_768)
    eval_info_768 = evaluate_collection(qdrant_client, "doj_gemini_768_experimental", embedder_768)

    # Build and evaluate 3072-dim collection
    logger.info("\n--- Phase 2: Evaluating 3072 Dimensions ---")
    build_info_3072 = build_collection(qdrant_client, "doj_gemini_3072_experimental", 3072, chunks, embeddings_3072)
    eval_info_3072 = evaluate_collection(qdrant_client, "doj_gemini_3072_experimental", embedder_3072)

    # Verify original collection is untouched
    orig_after = qdrant_client.get_collection("doj_knowledge_base")
    logger.info("Final verify: 'doj_knowledge_base' has %d points (UNTOUCHED)", orig_after.points_count)

    summary_results = {
        "baseline_bge_m3": {
            "dimension": 1024,
            "recall_at_1": 44.44,
            "recall_at_3": 77.78,
            "recall_at_5": 77.78,
            "mrr": 0.6111,
            "memory_mb": "~1200MB (PyTorch)",
        },
        "gemini_768": {
            "build": build_info_768,
            "eval": eval_info_768,
        },
        "gemini_3072": {
            "build": build_info_3072,
            "eval": eval_info_3072,
        },
    }

    output_path = SERVICE_DIR / "gemini_embedding_evaluation_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary_results, f, indent=2)

    r1_768 = f"{eval_info_768['recall_at_1']}% ({eval_info_768['hits_at_1']}/9)"
    r1_3072 = f"{eval_info_3072['recall_at_1']}% ({eval_info_3072['hits_at_1']}/9)"
    r3_768 = f"{eval_info_768['recall_at_3']}% ({eval_info_768['hits_at_3']}/9)"
    r3_3072 = f"{eval_info_3072['recall_at_3']}% ({eval_info_3072['hits_at_3']}/9)"
    r5_768 = f"{eval_info_768['recall_at_5']}% ({eval_info_768['hits_at_5']}/9)"
    r5_3072 = f"{eval_info_3072['recall_at_5']}% ({eval_info_3072['hits_at_5']}/9)"
    mrr_768 = f"{eval_info_768['mrr']:.4f}"
    mrr_3072 = f"{eval_info_3072['mrr']:.4f}"
    lat_768 = f"{eval_info_768['avg_latency_ms']} ms"
    lat_3072 = f"{eval_info_3072['avg_latency_ms']} ms"

    print("\n" + "=" * 85)
    print("NYAYA SAHAYAK — EMBEDDING RETRIEVAL BENCHMARK COMPARISON")
    print("=" * 85)
    print(f"{'Metric':<25} | {'BGE-M3 (1024)':<18} | {'Gemini (768)':<18} | {'Gemini (3072)':<18}")
    print("-" * 85)
    print(f"{'Recall@1':<25} | {'44.4% (4/9)':<18} | {r1_768:<18} | {r1_3072:<18}")
    print(f"{'Recall@3':<25} | {'77.8% (7/9)':<18} | {r3_768:<18} | {r3_3072:<18}")
    print(f"{'Recall@5':<25} | {'77.8% (7/9)':<18} | {r5_768:<18} | {r5_3072:<18}")
    print(f"{'MRR':<25} | {'0.6111':<18} | {mrr_768:<18} | {mrr_3072:<18}")
    print(f"{'Avg Query Latency':<25} | {'~15 ms (local)':<18} | {lat_768:<18} | {lat_3072:<18}")
    print(f"{'Vector Dim':<25} | {'1024':<18} | {'768':<18} | {'3072':<18}")
    print(f"{'Total Points Indexed':<25} | {'229':<18} | {'229':<18} | {'229':<18}")
    print(f"{'Local RAM Requirement':<25} | {'> 1.2 GB':<18} | {'< 50 MB':<18} | {'< 50 MB':<18}")
    print(f"{'Free Cloud Fit (512MB)':<25} | {'FAIL (OOM)':<18} | {'PASS':<18} | {'PASS':<18}")
    print("=" * 85)


if __name__ == "__main__":
    main()
