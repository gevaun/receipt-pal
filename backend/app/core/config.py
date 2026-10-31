from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Receipt Pal"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
