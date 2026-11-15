# Orbit Mafia backend (FastAPI) for Railway. Put this file at the REPO ROOT.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ENV=prod

WORKDIR /app

# Install runtime dependencies only (test/audit tools are not needed in production)
COPY backend/requirements.txt /tmp/requirements.txt
RUN grep -v -E '^(pytest|pytest-asyncio|bandit|pip-audit)==' /tmp/requirements.txt > /tmp/requirements.prod.txt \
 && pip install -r /tmp/requirements.prod.txt

# App code + the committed SQLite database (the app finds it at /app/data/processed/orbit_mafia.db)
COPY backend/ /app/backend/
COPY data/processed/orbit_mafia.db /app/data/processed/orbit_mafia.db

# Run as a non-root user
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser
WORKDIR /app/backend

EXPOSE 8000
# Railway injects $PORT. The proxy flags make per-visitor rate limiting work behind Railway's proxy.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
