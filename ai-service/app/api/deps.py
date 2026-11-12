"""
Nyaya Sahayak — API Dependencies & Internal Service Security Guard
"""

import hmac
import logging
from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


async def verify_internal_token(
    x_internal_service_key: Optional[str] = Header(None, alias="X-Internal-Service-Key"),
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    authorization: Optional[str] = Header(None),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Validates that incoming requests contain the correct internal service token.
    Supports standardized 'X-Internal-Service-Key: <token>', fallback 'X-Internal-Secret: <token>',
    or 'Authorization: Bearer <token>'.

    Security model:
    - If no internal_service_token is configured (local dev mode), access is permitted.
    - If internal_service_token is configured (production/cloud), invalid or missing credentials raise HTTP 401.
    """
    expected_token = settings.internal_service_token
    if not expected_token or not expected_token.strip():
        # Open access for unconfigured local development
        return

    provided_token = None
    if x_internal_service_key and x_internal_service_key.strip():
        provided_token = x_internal_service_key.strip()
    elif x_internal_secret and x_internal_secret.strip():
        provided_token = x_internal_secret.strip()
    elif authorization and authorization.strip():
        parts = authorization.strip().split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            provided_token = parts[1].strip()
        else:
            provided_token = parts[0].strip()

    if not provided_token or not hmac.compare_digest(provided_token, expected_token.strip()):
        logger.warning("Unauthorized access attempt to protected AI-service endpoint.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing internal service token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
