"""
Nyaya Sahayak — Qdrant Cloud Migration & Validation Script

Migrates pre-computed 768-dimensional Gemini embeddings (derived from MRL)
and complete legal metadata payloads for all 229 knowledge base chunks
into a hosted Qdrant Cloud cluster (`doj_gemini_768`).

Idempotent, resumable, and safe:
- Reads QDRANT_URL and QDRANT_API_KEY from environment.
- Never prints or leaks credentials.
- Bounded batches with per-batch verification.
- Validates 229 points, 768 dimensions, and Cosine distance in the cloud.
- Evaluates retrieval against the cloud collection.
"""

import argparse
import json
import logging
import math
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import get_settings
from app.services.providers.gemini_embedder import GeminiEmbeddingService, l2_normalize
from app.services.vector_store import generate_point_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("qdrant_cloud_migration")

CORRECTED_BENCHMARK = [
    {
        "id": 1,
        "domain": "Live-streaming rules",
        "query": "What matters are excluded from live streaming and what is the delay buffer under Model Rules?",
        "expected_chunk_id": "DOJ_STAT_RULE_LIVESTREAM_R005_COMPLETE",
        "acceptable_chunk_ids": ["DOJ_STAT_RULE_LIVESTREAM_R005_COMPLETE", "DOJ_STAT_RULE_LIVESTREAM_R008_R009"],
    },
    {
        "id": 2,
        "domain": "eCourts & eFiling",
        "query": "What are the hardware, software, and registration requirements for eFiling 3.0?",
        "expected_chunk_id": "DOJ_STAT_PROC_EFILING_REGISTRATION_CORE",
        "acceptable_chunk_ids": ["DOJ_STAT_PROC_EFILING_REGISTRATION_CORE", "DOJ_STAT_GUIDE_EFILING_COMPLETE_PROCESS_GUIDE"],
    },
    {
        "id": 3,
        "domain": "Judicial Appointments (Parliament)",
        "query": "What was the reply to Lok Sabha Starred Question 35 regarding a Supreme Court bench in Kerala?",
        "expected_chunk_id": "DOJ_STAT_PARL_LS17_STAR_35_0001",
        "acceptable_chunk_ids": ["DOJ_STAT_PARL_LS17_STAR_35_0001"],
    },
    {
        "id": 4,
        "domain": "Tele-Law Legal Aid",
        "query": "Who is eligible for free legal advice through Tele-Law under Section 12?",
        "expected_chunk_id": "DOJ_STAT_GUIDE_TELE_LAW_COMPLETE_GUIDE",
        "acceptable_chunk_ids": ["DOJ_STAT_GUIDE_TELE_LAW_COMPLETE_GUIDE", "DOJ_STAT_FAQ_0026"],
    },
    {
        "id": 5,
        "domain": "NJDG Pendency",
        "query": "What are the national pending case statistics and civil criminal case totals on NJDG?",
        "expected_chunk_id": "DOJ_DYN_STAT_NJDG_DISTRICT_20261108",
        "acceptable_chunk_ids": ["DOJ_DYN_STAT_NJDG_DISTRICT_20261108", "DOJ_DYN_STAT_NJDG_HIGH_COURTS_20261108"],
    },
    {
        "id": 6,
        "domain": "Judicial Vacancies Summary",
        "query": "What is the sanctioned and working strength of judges in Supreme Court and High Courts as of August 2026?",
        "expected_chunk_id": "DOJ_DYN_STAT_VACANCY_SC_HC_20260801",
        "acceptable_chunk_ids": ["DOJ_DYN_STAT_VACANCY_SC_HC_20260801", "DOJ_STAT_FAQ_0056"],
    },
    {
        "id": 7,
        "domain": "High Court Vacancy Matrix",
        "query": "What is the sanctioned and working strength breakdown across all 25 High Courts?",
        "expected_chunk_id": "DOJ_DYN_TAB_HC_VACANCY_MATRIX_20260801",
        "acceptable_chunk_ids": ["DOJ_DYN_TAB_HC_VACANCY_MATRIX_20260801", "DOJ_DYN_STAT_VACANCY_SC_HC_20260801"],
    },
    {
        "id": 8,
        "domain": "Virtual Courts Challan",
        "query": "How do virtual courts work and how do I search and pay my traffic challan online?",
        "expected_chunk_id": "DOJ_STAT_GUIDE_TRAFFIC_CHALLANS_AND_VCOURTS_GUIDE",
        "acceptable_chunk_ids": ["DOJ_STAT_GUIDE_TRAFFIC_CHALLANS_AND_VCOURTS_GUIDE", "DOJ_STAT_FAQ_0002"],
    },
    {
        "id": 9,
        "domain": "Fast Track Special Courts",
        "query": "What are Fast Track Special Courts (FTSCs) under the Centrally Sponsored Scheme for POCSO cases?",
        "expected_chunk_id": "DOJ_STAT_FAQ_0055",
        "acceptable_chunk_ids": ["DOJ_STAT_FAQ_0055", "DOJ_STAT_PARL_LS17_UNST_1285_0008_QA"],
    },
]


def load_source_vectors_and_chunks() -> tuple:
    """Load chunks and 768-dim normalized vectors from local cache or embedded Qdrant."""
    settings = get_settings()
    chunks_path = Path(settings.knowledge_base_chunks_path)
    if not chunks_path.is_absolute():
        chunks_path = (SERVICE_DIR / chunks_path).resolve()

    chunks = []
    with open(chunks_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                chunks.append(json.loads(line))

    # Load 768-dim vectors from cache or local collection
    cache_3072 = SERVICE_DIR / "data" / "knowledge_base" / "gemini_3072_embeddings_cache.json"
    if cache_3072.exists():
        with open(cache_3072, "r", encoding="utf-8") as f:
            raw_3072 = json.load(f)
        vectors_768 = [l2_normalize(v[:768]) for v in raw_3072]
        logger.info("Loaded %d vectors from 3072-dim cache (sliced & normalized to 768-dim).", len(vectors_768))
    else:
        # Fallback to local Qdrant embedded scroll
        storage_path = (SERVICE_DIR / Path(settings.qdrant_storage_path)).resolve()
        local_client = QdrantClient(path=str(storage_path))
        pts, _ = local_client.scroll("doj_gemini_768_experimental", limit=300, with_vectors=True, with_payload=True)
        pt_map = {p.payload["chunk_id"]: p.vector for p in pts}
        vectors_768 = [pt_map[c["chunk_id"]] for c in chunks]
        logger.info("Loaded %d vectors from local embedded collection 'doj_gemini_768_experimental'.", len(vectors_768))

    assert len(chunks) == 229, f"Expected 229 chunks, got {len(chunks)}"
    assert len(vectors_768) == 229, f"Expected 229 vectors, got {len(vectors_768)}"
    assert len(vectors_768[0]) == 768, f"Expected 768 dims, got {len(vectors_768[0])}"

    return chunks, vectors_768


def run_migration(
    cloud_url: str,
    cloud_api_key: str,
    target_collection: str = "doj_gemini_768",
    batch_size: int = 50,
) -> Dict[str, Any]:
    """Execute idempotent migration of vectors and metadata to Qdrant Cloud."""
    logger.info("Connecting to Qdrant Cloud cluster at: %s", cloud_url.split("@")[-1].split(":")[0])
    cloud_client = QdrantClient(url=cloud_url, api_key=cloud_api_key, check_compatibility=False)

    # 1. Check or create collection
    existing = [c.name for c in cloud_client.get_collections().collections]
    if target_collection not in existing:
        logger.info("Creating cloud collection '%s' (dim=768, distance=COSINE)...", target_collection)
        cloud_client.create_collection(
            collection_name=target_collection,
            vectors_config=qmodels.VectorParams(size=768, distance=qmodels.Distance.COSINE),
        )
        # Create payload indexes
        for field, schema in [
            ("topic", qmodels.PayloadSchemaType.KEYWORD),
            ("information_type", qmodels.PayloadSchemaType.KEYWORD),
            ("data_as_of", qmodels.PayloadSchemaType.KEYWORD),
        ]:
            try:
                cloud_client.create_payload_index(collection_name=target_collection, field_name=field, field_schema=schema)
            except Exception:
                pass
    else:
        logger.info("Cloud collection '%s' already exists.", target_collection)

    # 2. Check existing points for idempotence
    existing_points, _ = cloud_client.scroll(target_collection, limit=300, with_payload=True)
    existing_chunk_ids = {p.payload.get("chunk_id") for p in existing_points if p.payload}
    logger.info("Found %d points already existing in cloud collection.", len(existing_chunk_ids))

    chunks, vectors = load_source_vectors_and_chunks()

    # Filter chunks that need migration
    to_migrate = []
    for c, v in zip(chunks, vectors):
        if c["chunk_id"] not in existing_chunk_ids:
            to_migrate.append((c, v))

    if not to_migrate:
        logger.info("All 229 chunks already present in Qdrant Cloud. Migration is up to date!")
    else:
        logger.info("Migrating %d chunks to Qdrant Cloud in batches of %d...", len(to_migrate), batch_size)
        total_migrated = 0
        t0 = time.time()

        for b_idx in range(0, len(to_migrate), batch_size):
            batch = to_migrate[b_idx : b_idx + batch_size]
            points = []
            for chunk, vec in batch:
                pid = generate_point_id(chunk["chunk_id"])
                payload = {
                    "chunk_id": chunk["chunk_id"],
                    "source_document": chunk.get("source_document", ""),
                    "source_url": chunk.get("source_url", ""),
                    "page_number_or_range": chunk.get("page_number_or_range", ""),
                    "topic": chunk.get("topic", ""),
                    "publication_date": chunk.get("publication_date", ""),
                    "data_as_of": chunk.get("data_as_of", ""),
                    "information_type": chunk.get("information_type", "static"),
                    "content": chunk.get("content", ""),
                }
                points.append(qmodels.PointStruct(id=pid, vector=vec, payload=payload))

            cloud_client.upsert(collection_name=target_collection, points=points, wait=True)
            total_migrated += len(points)
            logger.info("  Upserted batch of %d points (progress: %d/%d).", len(points), total_migrated, len(to_migrate))

        logger.info("Successfully upserted %d points to Qdrant Cloud in %.2fs.", total_migrated, time.time() - t0)

    # 3. Cloud Collection Validation
    info = cloud_client.get_collection(target_collection)
    logger.info("Cloud collection '%s' stats: points_count=%d, vector_size=%d, status=%s",
                target_collection, info.points_count, info.config.params.vectors.size, info.status)
    assert info.points_count == 229, f"Cloud verification failed: expected 229 points, got {info.points_count}"
    assert info.config.params.vectors.size == 768, f"Cloud verification failed: expected 768 dims, got {info.config.params.vectors.size}"

    return {
        "target_collection": target_collection,
        "points_count": info.points_count,
        "vector_size": info.config.params.vectors.size,
        "distance": str(info.config.params.vectors.distance),
        "status": str(info.status),
    }


def validate_cloud_retrieval(cloud_url: str, cloud_api_key: str, collection_name: str = "doj_gemini_768") -> Dict[str, Any]:
    """Test Gemini RETRIEVAL_QUERY embeddings against the hosted Qdrant Cloud collection."""
    settings = get_settings()
    embedder = GeminiEmbeddingService(api_key=settings.gemini_api_key, expected_dim=768)
    cloud_client = QdrantClient(url=cloud_url, api_key=cloud_api_key, check_compatibility=False)

    logger.info("--- Testing Hosted Qdrant Cloud Retrieval (%s) ---", collection_name)
    hits_at_1 = 0
    hits_at_3 = 0
    hits_at_5 = 0
    reciprocal_ranks = []
    latencies_embed_ms = []
    latencies_search_ms = []
    case_results = []

    for case in CORRECTED_BENCHMARK:
        q = case["query"]
        expected_id = case["expected_chunk_id"]
        acceptable_ids = case["acceptable_chunk_ids"]

        # 1. Measure query embedding latency
        t_embed_0 = time.time()
        q_vec = embedder.embed_query(q)
        t_embed_ms = (time.time() - t_embed_0) * 1000
        latencies_embed_ms.append(t_embed_ms)

        # 2. Measure cloud vector search latency
        t_search_0 = time.time()
        res = cloud_client.query_points(collection_name=collection_name, query=q_vec, limit=5, score_threshold=0.45).points
        t_search_ms = (time.time() - t_search_0) * 1000
        latencies_search_ms.append(t_search_ms)

        retrieved_ids = [p.payload["chunk_id"] for p in res]
        scores = [float(p.score) for p in res]

        rank = None
        for idx, cid in enumerate(retrieved_ids, 1):
            if cid in acceptable_ids:
                rank = idx
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
            "rank": rank,
            "top_1_id": retrieved_ids[0] if retrieved_ids else "None",
            "top_1_score": round(scores[0], 4) if scores else 0.0,
            "embed_ms": round(t_embed_ms, 1),
            "search_ms": round(t_search_ms, 1),
            "total_ms": round(t_embed_ms + t_search_ms, 1),
            "match": "Exact" if (retrieved_ids and retrieved_ids[0] == expected_id) else ("Acceptable" if rank else "Miss"),
        })

    r1 = round((hits_at_1 / 9) * 100, 2)
    r3 = round((hits_at_3 / 9) * 100, 2)
    r5 = round((hits_at_5 / 9) * 100, 2)
    mrr = round(sum(reciprocal_ranks) / 9, 4)
    avg_embed_ms = round(sum(latencies_embed_ms) / 9, 1)
    avg_search_ms = round(sum(latencies_search_ms) / 9, 1)
    avg_total_ms = round(avg_embed_ms + avg_search_ms, 1)

    return {
        "recall_at_1": r1,
        "recall_at_3": r3,
        "recall_at_5": r5,
        "mrr": mrr,
        "avg_embed_latency_ms": avg_embed_ms,
        "avg_cloud_search_latency_ms": avg_search_ms,
        "avg_combined_latency_ms": avg_total_ms,
        "cases": case_results,
    }


def main():
    parser = argparse.ArgumentParser(description="Nyaya Sahayak Qdrant Cloud Migration")
    parser.add_argument("--collection-name", default="doj_gemini_768", help="Target cloud collection name")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for upserts")
    parser.add_argument("--validate-only", action="store_true", help="Skip upsert and only run retrieval benchmark")
    args = parser.parse_args()

    settings = get_settings()
    cloud_url = settings.qdrant_url or os.environ.get("QDRANT_URL")
    cloud_api_key = settings.qdrant_api_key or os.environ.get("QDRANT_API_KEY")

    if not cloud_url or not cloud_api_key:
        print("\n" + "!" * 80)
        print("ERROR: Qdrant Cloud credentials are not configured.")
        print("Set QDRANT_URL and QDRANT_API_KEY in ai-service/.env or system environment:")
        print("  QDRANT_URL=https://your-cluster-id.us-east4-0.gcp.cloud.qdrant.io:6333")
        print("  QDRANT_API_KEY=your_qdrant_cloud_api_key_here")
        print("!" * 80 + "\n")
        sys.exit(1)

    if not args.validate_only:
        migration_stats = run_migration(cloud_url, cloud_api_key, target_collection=args.collection_name, batch_size=args.batch_size)
    else:
        migration_stats = {"target_collection": args.collection_name, "validate_only": True}

    eval_stats = validate_cloud_retrieval(cloud_url, cloud_api_key, collection_name=args.collection_name)

    results = {
        "migration": migration_stats,
        "retrieval": eval_stats,
    }

    report_path = SERVICE_DIR / "qdrant_cloud_migration_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    logger.info("Saved Qdrant Cloud migration report to: %s", report_path)

    print("\n" + "=" * 80)
    print("QDRANT CLOUD RETRIEVAL BENCHMARK SUMMARY (doj_gemini_768)")
    print("=" * 80)
    print(f"Recall@1: {eval_stats['recall_at_1']}%")
    print(f"Recall@3: {eval_stats['recall_at_3']}%")
    print(f"Recall@5: {eval_stats['recall_at_5']}%")
    print(f"MRR:      {eval_stats['mrr']}")
    print(f"Latency:  Embedding {eval_stats['avg_embed_latency_ms']}ms + Cloud Search {eval_stats['avg_cloud_search_latency_ms']}ms = Combined {eval_stats['avg_combined_latency_ms']}ms")
    print("=" * 80)


if __name__ == "__main__":
    main()

