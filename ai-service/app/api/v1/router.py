"""
Nyaya Sahayak — API v1 Central Router
"""

from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.retrieve import router as retrieve_router
from app.api.v1.chat import router as chat_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(health_router)
api_v1_router.include_router(retrieve_router)
api_v1_router.include_router(chat_router)

