"""
Nyaya Sahayak — AI Service Configuration

Loads environment-based application, embedding, and vector database settings
with validation via Pydantic Settings.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


# Base directories
APP_DIR = Path(__file__).resolve().parent
SERVICE_DIR = APP_DIR.parent
ROOT_DIR = SERVICE_DIR.parent


class Settings(BaseSettings):
    """Application configuration and runtime settings."""

    # Server Configuration
    ai_service_host: str = "127.0.0.1"
    ai_service_port: int = 8000
    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    # Embedding Model Settings (BAAI/bge-m3 default)
    embedding_model_name: str = "BAAI/bge-m3"
    embedding_device: str = "auto"  # 'auto', 'mps', 'cuda', or 'cpu'
    embedding_dimension: int = 1024
    embedding_batch_size: int = 16
    normalize_embeddings: bool = True
    embedding_max_length: int = 8192

    # Vector Database Settings (Qdrant Embedded default)
    vector_store_type: Literal["qdrant", "chroma"] = "qdrant"
    qdrant_storage_path: str = str(SERVICE_DIR / "qdrant_storage")
    qdrant_collection_name: str = "doj_knowledge_base"
    chroma_storage_path: str = str(SERVICE_DIR / "chroma_db")

    # Knowledge Base Data Paths
    knowledge_base_chunks_path: str = str(
        SERVICE_DIR / "data" / "knowledge_base" / "rag_chunks.jsonl"
    )
    metadata_index_path: str = str(
        SERVICE_DIR / "data" / "knowledge_base" / "master_metadata_index.json"
    )
    content_classification_path: str = str(
        SERVICE_DIR / "data" / "knowledge_base" / "content_classification.json"
    )

    # Retrieval Defaults
    default_top_k: int = 3
    score_threshold: float = 0.45

    model_config = SettingsConfigDict(
        env_file=str(SERVICE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton instance of application settings."""
    return Settings()
