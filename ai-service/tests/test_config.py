"""
Unit tests for application configuration settings.
"""

from app.config import Settings, get_settings


def test_default_settings():
    settings = get_settings()
    assert settings.ai_service_host == "127.0.0.1"
    assert settings.ai_service_port == 8000
    assert settings.embedding_model_name == "BAAI/bge-m3"
    assert settings.embedding_dimension == 1024
    assert settings.vector_store_type == "qdrant"
    assert settings.default_top_k == 3

