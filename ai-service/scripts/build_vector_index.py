"""
Nyaya Sahayak — Vector Index Builder

Reads validated knowledge chunks from rag_chunks.jsonl, computes dense embeddings
using the configured embedding model (BAAI/bge-m3), and indexes them into
embedded Qdrant vector database with full metadata payloads.
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from app.services.embedder import EmbeddingService
from app.services.vector_store import QdrantVectorStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("build_vector_index")


def load_chunks(jsonl_path: Path):
    """Load chunks from jsonl file."""
    if not jsonl_path.exists():
        raise FileNotFoundError(f"Knowledge base file not found: {jsonl_path}")

    chunks = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))

    logger.info("Loaded %d validated chunks from %s", len(chunks), jsonl_path)
    return chunks


def build_index(recreate: bool = False, batch_size: int = 16):
    """Generate embeddings and index chunks into Qdrant."""
    settings = get_settings()
    chunks_path = Path(settings.knowledge_base_chunks_path)

    logger.info("Starting Vector Index Build Pipeline...")
    logger.info("Knowledge Base Source: %s", chunks_path)
    logger.info("Embedding Model: %s", settings.embedding_model_name)
    logger.info("Vector DB Target: %s", settings.qdrant_storage_path)

    chunks = load_chunks(chunks_path)

    # Initialize services
    embedder = EmbeddingService(settings=settings)
    vector_store = QdrantVectorStore(settings=settings)

    if recreate:
        logger.info("Recreate requested: Deleting collection '%s'...", vector_store.collection_name)
        try:
            vector_store.client.delete_collection(collection_name=vector_store.collection_name)
        except Exception as exc:
            logger.warning("Could not delete collection: %s", exc)
        vector_store._ensure_collection()

    # Extract texts for embedding
    texts = [c["content"] for c in chunks]

    start_time = time.time()
    total_chunks = len(chunks)
    logger.info("Computing embeddings for %d chunks in batches of %d...", total_chunks, batch_size)

    all_embeddings = []
    for i in range(0, total_chunks, batch_size):
        batch_texts = texts[i : i + batch_size]
        logger.info(
            "Encoding batch %d/%d (chunks %d to %d)...",
            (i // batch_size) + 1,
            (total_chunks + batch_size - 1) // batch_size,
            i + 1,
            min(i + batch_size, total_chunks),
        )
        batch_vecs = embedder.embed_documents(batch_texts, batch_size=batch_size)
        all_embeddings.extend(batch_vecs)

    encode_time = time.time() - start_time
    logger.info(
        "Finished encoding %d vectors in %.2f seconds (%.2f chunks/sec).",
        len(all_embeddings),
        encode_time,
        total_chunks / max(encode_time, 0.001),
    )

    # Upsert into Qdrant
    logger.info("Upserting points into Qdrant collection '%s'...", vector_store.collection_name)
    upsert_start = time.time()
    total_upserted = vector_store.upsert_chunks(chunks, all_embeddings)
    upsert_time = time.time() - upsert_start

    logger.info(
        "Successfully indexed %d chunks in %.2f seconds.",
        total_upserted,
        upsert_time,
    )

    # Verification query
    logger.info("Running verification test query...")
    test_query = "What are the rules regarding live streaming of court proceedings?"
    query_vector = embedder.embed_query(test_query)
    results = vector_store.search(query_vector=query_vector, top_k=2)

    logger.info("Verification query returned %d matches:", len(results))
    for idx, hit in enumerate(results, 1):
        logger.info(
            "  Match #%d: [%.4f] %s | %s",
            idx,
            hit["score"],
            hit["chunk_id"],
            hit.get("topic"),
        )

    stats = vector_store.get_stats()
    logger.info("Index build complete! Collection stats: %s", stats)
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Qdrant vector index from rag_chunks.jsonl")
    parser.add_argument("--recreate", action="store_true", help="Recreate collection from scratch")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for embedding generation")
    args = parser.parse_args()

    build_index(recreate=args.recreate, batch_size=args.batch_size)

