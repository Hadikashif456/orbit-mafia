"""Database utility module for opening SQLite in read-only mode for API routes."""

import sqlite3
from typing import Generator
from app.config import settings


def get_read_only_db() -> Generator[sqlite3.Connection, None, None]:
    """Provides a read-only SQLite connection for API queries.
    
    Uses URI syntax 'file:{path}?mode=ro' to enforce read-only access at the OS/driver level.
    """
    db_uri = f"file:{settings.DB_PATH}?mode=ro"
    # uri=True allows mode=ro in SQLite URI
    conn = sqlite3.connect(db_uri, uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
