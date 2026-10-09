import logging
import os
from typing import Any

import httpx
import json5
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from app.logging_config import setup_logging

load_dotenv()
setup_logging()
log = logging.getLogger(__name__)

app = FastAPI(title="Receipt Pal")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Proxies Money Manager's init data (accounts, categories, etc.).
# MONEY_MANAGER_BASE_URL should include the /moneyBook prefix,
# e.g. http://192.168.100.222:8888/moneyBook
@app.get("/get-initial-data")
async def initial_data() -> dict[str, Any]:
    base_url = os.getenv("MONEY_MANAGER_BASE_URL")
    if not base_url:
        log.error("MONEY_MANAGER_BASE_URL is not set")
        raise HTTPException(status_code=500, detail="MONEY_MANAGER_BASE_URL is not set")

    url = f"{base_url.rstrip('/')}/getInitData"
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
