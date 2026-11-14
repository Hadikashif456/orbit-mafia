"""Configuration module using pydantic-settings.

Refuses to start in production if ALLOWED_ORIGINS contains wildcard '*'.
Loads Groq API configurations with optional GROQ_API_KEY to support offline/cached operations.
"""

from typing import List, Optional, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENV: str = "dev"
    ALLOWED_ORIGINS: Union[str, List[str]] = "http://localhost:5173"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_FALLBACK_MODEL: str = "openai/gpt-oss-20b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_TIMEOUT_SECONDS: int = 8
    DB_PATH: str = "./orbit_mafia.db"
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_COPILOT: str = "10/minute"

    @property
    def allowed_origins_list(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, list):
            return self.ALLOWED_ORIGINS
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def groq_key_present(self) -> bool:
        """Returns True if GROQ_API_KEY is configured and non-empty."""
        return bool(self.GROQ_API_KEY and self.GROQ_API_KEY.strip())

    def validate_security(self) -> None:
        """Validate security posture, refusing wildcard origins in production."""
        if self.ENV.lower() == "prod":
            origins = self.allowed_origins_list
            if "*" in origins:
                raise ValueError("SECURITY VIOLATION: Wildcard CORS origin '*' is forbidden in production.")


settings = Settings()
settings.validate_security()
