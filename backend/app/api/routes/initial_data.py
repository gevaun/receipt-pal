import logging
from typing import Any

import httpx
import json5
from fastapi import APIRouter, HTTPException

from app.api.deps import MoneyManagerBaseUrl

router = APIRouter(tags=["money-manager"])
log = logging.getLogger(__name__)


# Proxies Money Manager's init data (accounts, categories, etc.).
# MONEY_MANAGER_BASE_URL should include the /moneyBook prefix,
# e.g. http://192.168.100.222:8888/moneyBook
@router.get("/get-initial-data")
async def initial_data(base_url: MoneyManagerBaseUrl) -> dict[str, Any]:
    url = f"{base_url}/moneyBook/getInitData"
    try:
        log.info("Fetching initial data from %s", url)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
        return json5.loads(response.text)
    except httpx.HTTPStatusError as exc:
        log.exception("Money Manager returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Failed to fetch initial data") from exc
    except httpx.RequestError as exc:
        log.exception("Failed to request initial data from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to fetch initial data") from exc
    except ValueError as exc:
        log.exception("Failed to parse initial data from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to parse initial data") from exc
