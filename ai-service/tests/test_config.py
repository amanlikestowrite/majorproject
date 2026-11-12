"""
Unit tests for application configuration settings.
"""

from app.config import Settings, get_settings


def test_default_settings():
    settings = get_settings()
    assert settings.ai_service_host == "127.0.0.1"
    assert settings.ai_service_port == 8000
    assert settings.embedding_provider == "local"
    assert settings.embedding_model_name == "BAAI/bge-m3"
    assert settings.embedding_dimension == 1024
    assert settings.vector_store_type == "qdrant"
    assert settings.vector_store_mode == "embedded"
    assert settings.qdrant_collection_name == "doj_knowledge_base"
    assert settings.gemini_embedding_model == "gemini-embedding-001"
    assert settings.gemini_embedding_dimension == 768
    assert settings.default_top_k == 3


def test_cloud_settings_override():
    settings = Settings(
        embedding_provider="gemini",
        vector_store_mode="cloud",
        qdrant_collection_name="doj_gemini_768",
        gemini_embedding_dimension=768,
        qdrant_url="https://test.cloud.qdrant.io:6333",
        qdrant_api_key="secret-key",
    )
    assert settings.embedding_provider == "gemini"
    assert settings.vector_store_mode == "cloud"
    assert settings.qdrant_collection_name == "doj_gemini_768"
    assert settings.gemini_embedding_dimension == 768
    assert settings.qdrant_url == "https://test.cloud.qdrant.io:6333"
    assert settings.qdrant_api_key == "secret-key"

