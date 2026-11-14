"""Configuration module using pydantic-settings.

Refuses to start in production if ALLOWED_ORIGINS contains wildcard '*'.
"""

from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENV: str = "dev"
    ALLOWED_ORIGINS: Union[str, List[str]] = "http://localhost:5173"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "claude-3-5-sonnet-20241022"
    DB_PATH: str = "./vitalorbit.db"
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_COPILOT: str = "10/minute"

    @property
    def allowed_origins_list(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, list):
            return self.ALLOWED_ORIGINS
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def validate_security(self) -> None:
        """Validate security posture, refusing wildcard origins in production."""
        if self.ENV.lower() == "prod":
            origins = self.allowed_origins_list
            if "*" in origins:
                raise ValueError("SECURITY VIOLATION: Wildcard CORS origin '*' is forbidden in production.")


settings = Settings()
settings.validate_security()
