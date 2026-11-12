"""
Nyaya Sahayak — Department of Justice AI Service Entry Point
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.v1.router import api_v1_router
from app.services.startup_validator import validate_startup_configuration

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nyaya_sahayak")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    logger.info("Initializing Nyaya Sahayak AI Service...")
    logger.info("Environment: %s", settings.environment)
    logger.info("Host: %s, Port: %d", settings.ai_service_host, settings.ai_service_port)
    logger.info("Embedding Provider: %s", settings.embedding_provider)
    logger.info("Vector Store Mode: %s", getattr(settings, "vector_store_mode", "embedded"))
    logger.info("Target Collection: %s", settings.qdrant_collection_name)

    # Perform startup validation (dimension, collection existence, and provider safety)
    validate_startup_configuration(settings)

    yield
    logger.info("Shutting down Nyaya Sahayak AI Service.")


app = FastAPI(
    title="Nyaya Sahayak — AI Knowledge & Legal Retrieval Service",
    description="Department of Justice (DoJ) conversational assistant backend providing vector search and grounded citations.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Gateway and local CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint verifying service availability."""
    return {
        "service": "nyaya-sahayak-ai-service",
        "status": "operational",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }

