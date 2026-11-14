"""Database utility module for opening SQLite in read-only mode for API routes.

B1 fix, Hour 16-26 (generic error responses). Hadi.

The connect used to raise sqlite3.OperationalError when the db file did
not exist yet, and FastAPI turned that into a 500 during dependency
resolution, before any endpoint code could catch it. Now a missing db
answers 503 with a generic message: no file paths, no stack traces.
When the db file exists, behaviour is unchanged.
"""

import sqlite3
from typing import Generator

from fastapi import HTTPException, status

from app.config import settings


def get_read_only_db() -> Generator[sqlite3.Connection, None, None]:
    """Provides a read-only SQLite connection for API queries.

    Uses URI syntax 'file:{path}?mode=ro' to enforce read-only access at the OS/driver level.
    """
    db_uri = f"file:{settings.DB_PATH}?mode=ro"
    # uri=True allows mode=ro in SQLite URI
    try:
        conn = sqlite3.connect(db_uri, uri=True, check_same_thread=False)
    except sqlite3.Error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Data store unavailable. Run the ingest and synthetic scripts first.",
        )
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
