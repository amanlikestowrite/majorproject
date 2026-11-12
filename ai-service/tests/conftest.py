"""
Pytest configuration and test isolation fixtures for Nyaya Sahayak AI Service.
Provides lightweight mocks for optional heavyweight runtime dependencies (torch, qdrant)
to ensure test suites run reliably in all environments.
"""

import sys
from unittest.mock import MagicMock
import pytest
import inspect
import asyncio

# Ensure project root is in sys.path
from pathlib import Path
SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

# Safe module stubs for heavy ML packages if not installed
for mod in [
    "torch",
    "torch.nn",
    "sentence_transformers",
    "qdrant_client",
    "qdrant_client.http",
    "qdrant_client.http.models",
]:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()


def pytest_pyfunc_call(pyfuncitem):
    """Automatically run async test functions with asyncio.run if pytest-asyncio is absent."""
    if inspect.iscoroutinefunction(pyfuncitem.obj):
        argnames = pyfuncitem._fixtureinfo.argnames
        args = [pyfuncitem.funcargs[arg] for arg in argnames]
        asyncio.run(pyfuncitem.obj(*args))
        return True
    return None
