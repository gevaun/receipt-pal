import logging
from typing import Any
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, HTTPException

from app.api.deps import MoneyManagerBaseUrl

router = APIRouter(tags=["money-manager"])
log = logging.getLogger(__name__)


def _parse_transactions_xml(text: str) -> dict[str, Any]:
    """Convert Money Manager's <dataset> XML into {"results": n, "rows": [{...}]}."""
    root = ElementTree.fromstring(text)
    results = root.findtext("results")
    rows = [{child.tag: child.text or "" for child in row} for row in root.findall("row")]
    return {"results": int(results) if results else len(rows), "rows": rows}


@router.get("/get-transactions")
async def get_transactions(
    base_url: MoneyManagerBaseUrl,
    start_date: str,
    end_date: str,
    mbid: int | None = None,
    asset_id: str | None = None,
    _dc: str | None = None,
) -> dict[str, Any]:
    url = f"{base_url}/moneyBook/getDataByPeriod"
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
