"""
Nyaya Sahayak — API v1 Central Router
"""

from fastapi import APIRouter, Depends
from app.api.deps import verify_internal_token
from app.api.v1.health import router as health_router
from app.api.v1.retrieve import router as retrieve_router
from app.api.v1.chat import router as chat_router

api_v1_router = APIRouter(prefix="/api/v1")

# Health is publicly accessible for Render uptime probes & orchestration
api_v1_router.include_router(health_router)

# Retrieval and chat require internal service token verification
api_v1_router.include_router(
    retrieve_router,
    dependencies=[Depends(verify_internal_token)],
)
api_v1_router.include_router(
    chat_router,
    dependencies=[Depends(verify_internal_token)],
)

