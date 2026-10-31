import logging
import os
from typing import Annotated, Literal

from fastapi import Depends, HTTPException

from app.core import settings_store

log = logging.getLogger(__name__)

BaseUrlSource = Literal["file", "env"]


def resolve_money_manager_base_url() -> tuple[str | None, BaseUrlSource | None]:
    saved = settings_store.load().money_manager_base_url
    if saved:
        return saved.rstrip("/"), "file"
    env = os.getenv("MONEY_MANAGER_BASE_URL")
    if env:
        return env.rstrip("/"), "env"
    return None, None


def get_money_manager_base_url() -> str:
    base_url, _ = resolve_money_manager_base_url()
    if not base_url:
        log.error("Money Manager address is not set")
        raise HTTPException(
            status_code=500, detail="Money Manager address is not set. Add it in Settings."
        )
    return base_url


MoneyManagerBaseUrl = Annotated[str, Depends(get_money_manager_base_url)]
