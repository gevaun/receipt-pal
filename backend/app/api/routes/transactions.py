import logging
from typing import Annotated, Any
from urllib.parse import quote, urlencode
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, Form, HTTPException

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


@router.post("/create-transaction")
async def create_transaction(
    base_url: MoneyManagerBaseUrl,
    mb_date: Annotated[str, Form(alias="mbDate")],
    mb_cash: Annotated[float, Form(alias="mbCash")],
    in_out_type: Annotated[str, Form(alias="inOutType")],
    in_out_code: Annotated[int, Form(alias="inOutCode")],
    pay_type: Annotated[str, Form(alias="payType")],
    mb_category: Annotated[str, Form(alias="mbCategory")],
    sub_category: Annotated[str, Form(alias="subCategory")],
    mb_content: Annotated[str, Form(alias="mbContent")],
    mb_detail_content: Annotated[str, Form(alias="mbDetailContent")],
    asset_id: Annotated[str, Form(alias="assetId")],
    mcid: Annotated[int, Form()],
    mcscid: Annotated[str, Form()],
) -> dict[str, Any]:
    url = f"{base_url}/moneyBook/create"
    data = {
        "mbDate": mb_date,
        "mbCash": mb_cash,
        "inOutType": in_out_type,
        "inOutCode": in_out_code,
        "payType": pay_type,
        "mbCategory": mb_category,
        "subCategory": sub_category,
        "mbContent": mb_content,
        "mbDetailContent": mb_detail_content,
        "assetId": asset_id,
        "mcid": mcid,
        "mcscid": mcscid,
    }
    try:
        log.info("Creating transaction at %s", url)
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Money Manager stores "+" literally, so encode spaces as %20 rather than
            # letting httpx form-encode them as "+".
            response = await client.post(
                url,
                content=urlencode(data, quote_via=quote, safe=":"),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
        return {"result": response.text}
    except httpx.HTTPStatusError as exc:
        log.exception("Money Manager returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Failed to create transaction") from exc
    except httpx.RequestError as exc:
        log.exception("Failed to request transaction creation from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to create transaction") from exc
