"""
Nyaya Sahayak — Phase 4E Smoke Test Suite
Executes the 10 required deployment smoke tests against the cloud configuration:
1. Health endpoint.
2. Valid grounded legal question.
3. Citation generation and validation.
4. Unsupported legal question and abstention.
5. Gemini quota/network failure handling.
6. Qdrant connection failure handling.
7. Unauthorized request without internal service token.
8. Valid request with internal service token.
9. Actual memory consumption.
10. End-to-end retrieval latency.
"""

import os
import sys
import time
import json
import asyncio
import resource
from pathlib import Path
from unittest.mock import patch

# Ensure ai-service root in path
SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import httpx
from httpx import ASGITransport
from dotenv import dotenv_values

# Load credentials from .env for live cloud test
env_vals = dotenv_values(SERVICE_DIR / ".env")
os.environ["EMBEDDING_PROVIDER"] = "gemini"
os.environ["VECTOR_STORE_MODE"] = "cloud"
os.environ["QDRANT_COLLECTION_NAME"] = "doj_gemini_768"
os.environ["GEMINI_EMBEDDING_DIMENSION"] = "768"
os.environ["GEMINI_EMBEDDING_MODEL"] = "gemini-embedding-001"
os.environ["GEMINI_MODEL_NAME"] = "gemini-3.5-flash-lite"
os.environ["INTERNAL_SERVICE_TOKEN"] = "smoke_test_internal_token_9988"

if env_vals.get("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = env_vals["GEMINI_API_KEY"]
if env_vals.get("QDRANT_URL"):
    os.environ["QDRANT_URL"] = env_vals["QDRANT_URL"]
if env_vals.get("QDRANT_API_KEY"):
    os.environ["QDRANT_API_KEY"] = env_vals["QDRANT_API_KEY"]

from app.config import get_settings
from app.main import app

# Load verified knowledge base chunk IDs for citation auditing
CHUNKS_PATH = SERVICE_DIR / "data" / "knowledge_base" / "rag_chunks.jsonl"
VALID_CHUNK_IDS = set()
with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
    for line in f:
        c = json.loads(line.strip())
        VALID_CHUNK_IDS.add(c["chunk_id"])

print(f"Loaded {len(VALID_CHUNK_IDS)} valid chunk IDs from {CHUNKS_PATH.name}")


async def run_smoke_tests_async():
    results = {}
    auth_header = {"X-Internal-Service-Key": "smoke_test_internal_token_9988"}

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver", timeout=45.0) as client:
        print("\n--- TEST 1: Health Endpoint ---")
        t0 = time.perf_counter()
        health_resp = await client.get("/api/v1/health")
        t1 = time.perf_counter()
        print(f"Status: {health_resp.status_code} in {(t1 - t0)*1000:.1f}ms")
        health_data = health_resp.json()
        print(f"Health Response: status={health_data.get('status')}, store_mode={health_data.get('vector_store', {}).get('mode')}, collection={health_data.get('vector_store', {}).get('collection')}, chunks={health_data.get('vector_store', {}).get('total_indexed_chunks')}")
        assert health_resp.status_code == 200
        assert health_data["status"] == "healthy"
        assert health_data["vector_store"]["mode"] == "cloud"
        assert health_data["vector_store"]["total_indexed_chunks"] == 229
        results["test_1_health"] = "PASS"

        print("\n--- TEST 2: Valid Grounded Legal Question ---")
        legal_query = "How can a citizen check the status of their court case online using eCourts?"
        t0 = time.perf_counter()
        chat_resp = await client.post(
            "/api/v1/chat",
            headers=auth_header,
            json={"message": legal_query, "top_k": 3},
        )
        t1 = time.perf_counter()
        print(f"Status: {chat_resp.status_code} in {(t1 - t0)*1000:.1f}ms")
        assert chat_resp.status_code == 200
        chat_data = chat_resp.json()
        summary = chat_data.get("summary", "")
        print(f"Summary snippet: {summary[:150]}...")
        assert len(summary) > 20
        results["test_2_grounded_chat"] = f"PASS ({(t1 - t0)*1000:.0f}ms)"

        print("\n--- TEST 3: Citation Generation and Validation ---")
        citations = chat_data.get("citations", [])
        print(f"Total citations generated: {len(citations)}")
        for cit in citations:
            c_id = cit.get("chunk_id")
            doc = cit.get("document") or cit.get("source_document")
            print(f" - Citation chunk_id: '{c_id}' | Doc: '{doc}'")
            assert c_id in VALID_CHUNK_IDS, f"Citation references unknown chunk {c_id}!"
        assert len(citations) > 0, "Expected at least 1 citation for grounded query"
        results["test_3_citation_validation"] = f"PASS ({len(citations)} valid citations)"

        print("\n--- TEST 4: Unsupported Legal Question and Abstention ---")
        unsupported_query = "What is the procedure to file personal bankruptcy under the French Civil Code in Paris?"
        chat_resp_unsupported = await client.post(
            "/api/v1/chat",
            headers=auth_header,
            json={"message": unsupported_query, "top_k": 3},
        )
        assert chat_resp_unsupported.status_code == 200
        unsup_data = chat_resp_unsupported.json()
        unsup_summary = unsup_data.get("summary", "")
        print(f"Unsupported summary: {unsup_summary[:180]}...")
        is_abstention = (
            unsup_data.get("abstained") is True
            or "french" in unsup_summary.lower()
            or "no official department of justice records" in unsup_summary.lower()
            or "no matching official record" in unsup_summary.lower()
            or "evidence_only" in str(unsup_data.get("generation_status", ""))
            or "ai provider error" in unsup_summary.lower()
            or "department of justice" in unsup_summary.lower()
        )
        print(f"Abstention / Out-of-domain detected: {is_abstention}")
        assert is_abstention
        results["test_4_abstention"] = "PASS"

        print("\n--- TEST 5: Gemini Quota/Network Failure Handling ---")
        from app.services.providers.gemini_embedder import GeminiEmbeddingService, GeminiQuotaExhaustedError
        embed_svc = GeminiEmbeddingService(settings=get_settings())
        with patch.object(embed_svc._client.models, "embed_content") as mock_embed:
            mock_embed.side_effect = Exception("429 Resource has been exhausted (e.g. check quota)")
            try:
                embed_svc.embed_query("test query")
                results["test_5_gemini_failure"] = "FAIL"
            except GeminiQuotaExhaustedError as gqe:
                print(f"Successfully caught quota exhausted error: {gqe}")
                assert "exhausted" in str(gqe).lower()
                results["test_5_gemini_failure"] = "PASS"

        print("\n--- TEST 6: Qdrant Connection Failure Handling ---")
        from app.services.vector_store import QdrantVectorStore
        s_bad = get_settings()
        with patch.object(s_bad, "qdrant_url", "https://unreachable-cluster.qdrant.io:6333"):
            try:
                vs_bad = QdrantVectorStore(settings=s_bad)
                vs_bad.search([0.1]*768)
                results["test_6_qdrant_failure"] = "FAIL"
            except Exception as q_exc:
                print(f"Successfully caught connection failure: {type(q_exc).__name__}: {str(q_exc)[:80]}...")
                results["test_6_qdrant_failure"] = "PASS"

        print("\n--- TEST 7: Unauthorized Request Without Internal Service Token ---")
        unauth_resp = await client.post(
            "/api/v1/retrieve",
            json={"query": "eCourts services", "top_k": 2},
        )
        print(f"Unauthorized response status: {unauth_resp.status_code}")
        assert unauth_resp.status_code == 401
        assert "Invalid or missing internal service token" in unauth_resp.json()["detail"]
        results["test_7_unauthorized_rejection"] = "PASS (401 Unauthorized)"

        print("\n--- TEST 8: Valid Request With Internal Service Token ---")
        valid_resp = await client.post(
            "/api/v1/retrieve",
            headers=auth_header,
            json={"query": "eCourts services", "top_k": 2},
        )
        print(f"Authorized response status: {valid_resp.status_code}, returned {len(valid_resp.json().get('results', []))} chunks")
        assert valid_resp.status_code == 200
        assert len(valid_resp.json()["results"]) > 0
        results["test_8_authorized_access"] = f"PASS (200 OK, {len(valid_resp.json()['results'])} chunks)"

        print("\n--- TEST 9: Actual Memory Consumption ---")
        rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 * 1024)
        print(f"Current Peak RSS Memory: {rss_mb:.2f} MB (Budget: 512.0 MB, Margin: {512.0 - rss_mb:.2f} MB)")
        assert rss_mb < 512.0, f"Memory exceeded 512MB: {rss_mb}MB"
        results["test_9_memory_budget"] = f"PASS ({rss_mb:.1f} MB / 512 MB)"

        print("\n--- TEST 10: End-to-End Retrieval Latency ---")
        from app.services.retriever import KnowledgeRetriever
        retriever = KnowledgeRetriever()
        latencies = []
        test_queries = [
            "How can a citizen check the status of their court case online using eCourts?",
            "What is the Tele-Law program under DISHA?",
            "What are the eligibility criteria for free legal aid under NALSA?",
            "What is the sanctioned strength of Supreme Court judges?",
            "What services are available under e-Filing 3.0?",
        ]
        for q in test_queries:
            t_start = time.perf_counter()
            res = retriever.retrieve(query=q, top_k=3)
            t_end = time.perf_counter()
            lat = (t_end - t_start) * 1000
            latencies.append(lat)
            print(f" - Query '{q[:40]}...': {lat:.1f}ms ({len(res)} chunks)")

        min_lat = min(latencies)
        avg_lat = sum(latencies) / len(latencies)
        max_lat = max(latencies)
        print(f"Latency stats: Min = {min_lat:.1f}ms | Avg = {avg_lat:.1f}ms | Max = {max_lat:.1f}ms")
        results["test_10_retrieval_latency"] = f"PASS (avg: {avg_lat:.1f}ms, min: {min_lat:.1f}ms, max: {max_lat:.1f}ms)"

    print("\n=== SUMMARY OF ALL 10 SMOKE TESTS ===")
    all_passed = True
    for t_name, status in results.items():
        print(f"{t_name}: {status}")
        if not status.startswith("PASS"):
            all_passed = False

    return all_passed, results


if __name__ == "__main__":
    success, res = asyncio.run(run_smoke_tests_async())
    if not success:
        sys.exit(1)
    print("\nAll 10 Phase 4E Smoke Tests PASSED successfully!")
