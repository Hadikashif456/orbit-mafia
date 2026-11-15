"""FastAPI application entry point for Orbit Mafia backend."""

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

logger = logging.getLogger("orbitmafia")

app = FastAPI(
    title="Orbit Mafia API",
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
    if request.method in ("POST", "PUT", "PATCH"):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > 1024:
                    return JSONResponse(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        content={"error": {"code": "VALIDATION_ERROR", "message": "Request body exceeds maximum size (1 KB)."}},
                    )
            except ValueError:
                pass
        body = await request.body()
        if len(body) > 1024:
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
@app.get("/health", include_in_schema=False)
def health_check():
    """Health check endpoint confirming service readiness."""
    return {"status": "ok"}


@app.get("/", tags=["Root"])
def root_info():
    """Service info and entrypoint."""
    return {
        "app": "Orbit Mafia",
        "status": "ok",
        "version": "1.0.0",
        "docs": "/docs" if settings.ENV != "prod" else None,
        "api": "/api/v1",
    }


@app.get("/crew", include_in_schema=False)
def get_crew_alias(sol: int = 144):
    """Compatibility alias for /api/v1/crew."""
    from app.routers.crew import get_crew_summaries
    return get_crew_summaries(sol=sol)


@app.get("/alerts", include_in_schema=False)
@app.get("/api/v1/alerts", tags=["Alerts"])
def get_alerts_alias(sol: int = 144):
    """Active scenario alerts (defaults to Sol 144)."""
    from app.services.scenario_engine import get_scenario_state
    safe_sol = min(max(140, sol), 145)
    state = get_scenario_state(safe_sol)
    return {"alerts": state.alerts, "sol": safe_sol}


# Dependency Health Check
@app.get("/api/v1/health/deps", tags=["Health"])
def health_deps_check():
    """Reports dependency readiness (db, groq_key_present) without revealing secrets."""
    db_available = False
    try:
        from pathlib import Path
        import sqlite3
        db_path = Path(settings.DB_PATH)
        if not db_path.exists():
            repo_root = Path(__file__).resolve().parents[2]
            cand = repo_root / "backend" / db_path
            if cand.exists():
                db_path = cand
            else:
                cand2 = repo_root / db_path
                if cand2.exists():
                    db_path = cand2
        if db_path.exists():
            uri = f"file:{db_path.resolve().as_posix()}?mode=ro"
            conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
            vitals_count = conn.execute("SELECT COUNT(*) FROM vitals").fetchone()[0]
            biomarkers_count = conn.execute("SELECT COUNT(*) FROM biomarkers").fetchone()[0]
            conn.close()
            if vitals_count > 0 and biomarkers_count > 0:
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
