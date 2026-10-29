import logging
import os
from typing import Any
from xml.etree import ElementTree

import httpx
import json5
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from app.core.config import settings
from app.logging_config import setup_logging

load_dotenv()
setup_logging()
log = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)


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

    url = f"{base_url.rstrip('/')}/moneyBook/getInitData"
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


def _parse_transactions_xml(text: str) -> dict[str, Any]:
    """Convert Money Manager's <dataset> XML into {"results": n, "rows": [{...}]}."""
    root = ElementTree.fromstring(text)
    results = root.findtext("results")
    rows = [{child.tag: child.text or "" for child in row} for row in root.findall("row")]
    return {"results": int(results) if results else len(rows), "rows": rows}


@app.get("/get-transactions")
async def get_transactions(
    start_date: str,
    end_date: str,
    mbid: int | None = None,
    asset_id: str | None = None,
    _dc: str | None = None,
) -> dict[str, Any]:
    base_url = os.getenv("MONEY_MANAGER_BASE_URL")
    if not base_url:
        log.error("MONEY_MANAGER_BASE_URL is not set")
        raise HTTPException(status_code=500, detail="MONEY_MANAGER_BASE_URL is not set")

    url = f"{base_url.rstrip('/')}/moneyBook/getDataByPeriod"
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "mbid": mbid,
        "assetId": asset_id,
        "_dc": _dc,
    }
    try:
        log.info("Fetching transactions from %s with params %s", url, params)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
        return _parse_transactions_xml(response.text)
    except httpx.HTTPStatusError as exc:
        log.exception("Money Manager returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Failed to fetch transactions") from exc
    except httpx.RequestError as exc:
        log.exception("Failed to request transactions from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to fetch transactions") from exc
    except (ValueError, ElementTree.ParseError) as exc:
        log.exception("Failed to parse transactions from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to parse transactions") from exc
