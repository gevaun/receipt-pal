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


async def _post_form(url: str, data: dict[str, Any], safe: str = ":") -> httpx.Response:
    """POST form data to Money Manager, raising httpx errors on failure."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Money Manager stores "+" literally, so encode spaces as %20 rather than
        # letting httpx form-encode them as "+".
        response = await client.post(
            url,
            content=urlencode(data, quote_via=quote, safe=safe),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
    return response


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
    asset_id: Annotated[str, Form(alias="assetId")],
    mcid: Annotated[str, Form()],
    mcscid: Annotated[str, Form()],
    mb_detail_content: Annotated[str, Form(alias="mbDetailContent")] = "",
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
        response = await _post_form(url, data)
        return {"result": response.text}
    except httpx.HTTPStatusError as exc:
        log.exception("Money Manager returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Failed to create transaction") from exc
    except httpx.RequestError as exc:
        log.exception("Failed to request transaction creation from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to create transaction") from exc


@router.post("/update-transaction")
async def update_transaction(
    base_url: MoneyManagerBaseUrl,
    id: Annotated[str, Form()],
    mb_date: Annotated[str, Form(alias="mbDate")],
    asset_id: Annotated[str, Form(alias="assetId")],
    pay_type: Annotated[str, Form(alias="payType")],
    mcid: Annotated[str, Form()],
    mb_category: Annotated[str, Form(alias="mbCategory")],
    mcscid: Annotated[str, Form()],
    sub_category: Annotated[str, Form(alias="subCategory")],
    mb_content: Annotated[str, Form(alias="mbContent")],
    mb_cash: Annotated[float, Form(alias="mbCash")],
    in_out_code: Annotated[int, Form(alias="inOutCode")],
    in_out_type: Annotated[str, Form(alias="inOutType")],
    mb_detail_content: Annotated[str, Form(alias="mbDetailContent")] = "",
    to_asset_id: Annotated[str, Form(alias="toAssetId")] = "",
    target_asset_id: Annotated[str, Form(alias="targetAssetId")] = "",
) -> dict[str, Any]:
    url = f"{base_url}/moneyBook/update"
    data = {
        "id": id,
        "mbDate": mb_date,
        "assetId": asset_id,
        "toAssetId": to_asset_id,
        "targetAssetId": target_asset_id,
        "payType": pay_type,
        "mcid": mcid,
        "mbCategory": mb_category,
        "mcscid": mcscid,
        "subCategory": sub_category,
        "mbContent": mb_content,
        "mbCash": mb_cash,
        "inOutCode": in_out_code,
        "inOutType": in_out_type,
        "mbDetailContent": mb_detail_content,
    }
    try:
        log.info("Updating transaction %s at %s", id, url)
        response = await _post_form(url, data)
        return {"result": response.text}
    except httpx.HTTPStatusError as exc:
        log.exception("Money Manager returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Failed to update transaction") from exc
    except httpx.RequestError as exc:
        log.exception("Failed to request transaction update from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to update transaction") from exc


@router.post("/delete-transactions")
async def delete_transactions(
    base_url: MoneyManagerBaseUrl,
    ids: Annotated[list[str], Form(min_length=1)],
) -> dict[str, Any]:
    url = f"{base_url}/moneyBook/delete"
    data = {"ids": "".join(f":{id_}" for id_ in ids)}
    try:
        log.info("Deleting %d transaction(s) at %s", len(ids), url)
        response = await _post_form(url, data, safe="")
        return {"result": response.text}
    except httpx.HTTPStatusError as exc:
        log.exception("Money Manager returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Failed to delete transactions") from exc
    except httpx.RequestError as exc:
        log.exception("Failed to request transaction deletion from Money Manager")
        raise HTTPException(status_code=502, detail="Failed to delete transactions") from exc
