import logging
import os
from typing import Annotated

from fastapi import Depends, HTTPException

log = logging.getLogger(__name__)


def get_money_manager_base_url() -> str:
    base_url = os.getenv("MONEY_MANAGER_BASE_URL")
    if not base_url:
        log.error("MONEY_MANAGER_BASE_URL is not set")
        raise HTTPException(status_code=500, detail="MONEY_MANAGER_BASE_URL is not set")
    return base_url.rstrip("/")


MoneyManagerBaseUrl = Annotated[str, Depends(get_money_manager_base_url)]
