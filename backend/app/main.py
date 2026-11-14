"""FastAPI application entry point for VitalOrbit backend."""

import logging
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.security.headers import SecurityHeadersMiddleware
from app.security.rate_limit import limiter
from app.routers import crew_router, scenario_router, copilot_router, provenance_router

logger = logging.getLogger("vitalorbit")

app = FastAPI(
    title="VitalOrbit API",
    description="Autonomous astronaut health resilience monitoring backend.",
    version="1.0.0",
    docs_url="/docs" if settings.ENV != "prod" else None,
    redoc_url=None,
)

# Attach SlowAPI rate limiter to application state
app.state.limiter = limiter

# 1. Request size limit middleware (<= 1 KB per request body)
@app.middleware("http")
async def limit_request_size_middleware(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 1024:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Request body exceeds maximum size (1 KB)."}},
        )
    return await call_next(request)

# 2. CORS allowlist middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# 3. Hardened security headers middleware
app.add_middleware(SecurityHeadersMiddleware)


# Exception Handlers (Generic responses, no stack traces or leaking internals)
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Rate limit exceeded. Please retry later."}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid request parameter or schema violation."}},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": exc.detail}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "INTERNAL", "message": "Something went wrong"}},
    )


# Root Health Check
@app.get("/api/v1/health", tags=["Health"])
def health_check():
    """Health check endpoint confirming service readiness."""
    return {"status": "ok"}


# Dependency Health Check
@app.get("/api/v1/health/deps", tags=["Health"])
def health_deps_check():
    """Reports dependency readiness (db, groq_key_present) without revealing secrets."""
    db_available = False
    try:
        import os
        import sqlite3
        if os.path.exists(settings.DB_PATH):
            conn = sqlite3.connect(f"file:{settings.DB_PATH}?mode=ro", uri=True)
            conn.execute("SELECT 1")
            conn.close()
            db_available = True
    except Exception:
        db_available = False

    return {
        "db": db_available,
        "groq_key_present": settings.groq_key_present,
    }


# Mount API v1 Routers
app.include_router(crew_router, prefix="/api/v1")
app.include_router(scenario_router, prefix="/api/v1")
app.include_router(copilot_router, prefix="/api/v1")
app.include_router(provenance_router, prefix="/api/v1")
