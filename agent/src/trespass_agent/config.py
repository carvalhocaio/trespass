"""Central service configuration, validated from the environment.

Cloud Run injects environment variables at runtime; this module is the single
source of truth for reading and validating them. Import `settings` where needed.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TRESPASS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Attacking agent credentials (the LLM that generates the probes) ---
    # This is the Gemini key used by the adversarial brain - it is not
    # related to the Target credential, which comes per request.
    gemini_api_key: SecretStr = Field(...)
    attacker_model: str = Field(default="gemini-flash-latest")

    # --- Attack loop limits ---
    # Hard ceiling on crescendo turns. Keeps cost and latency under control
    # and avoids infinite loops. 5-20 is the usual range; 8 is a sober default.
    max_turns: int = Field(default=8, ge=1, le=20)

    # Timeout (seconds) for ONE call to the target endpoint. The target is external and
    # arbitrary, so we never trust it to respond quickly.
    target_timeout_secods: float = Field(default=30.0, ge=0, le=120.0)

    # Time ceiling of the entire loop, as an additional seatbelt to
    # max_turns. Kept well below the Cloud Run function limit.
    run_badge_seconds: float = Field(default=240.0, gt=0)

    # --- Operational ---
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(default="INFO")
    # Cloud Run injects PORT automatically; default 8080 is its convention.
    port: int = Field(default=8080, ge=1, le=65535)


@lru_cache
def get_settings() -> Settings:
    """Returns the unique instance of Settings (cached).

    The lru_cache ensures that the environment is read and validated only once per
    process. In tests, call `get_settings.cache_clear()` to force
    re-reading with different variables.
    """
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
