import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.deps import BaseUrlSource, resolve_money_manager_base_url
from app.core import settings_store

router = APIRouter(prefix="/settings", tags=["settings"])
log = logging.getLogger(__name__)


class Settings(BaseModel):
    money_manager_base_url: str | None
    source: BaseUrlSource | None


class SettingsUpdate(BaseModel):
    money_manager_base_url: str


class ConnectionStatus(BaseModel):
    configured: bool
    reachable: bool
    money_manager_base_url: str | None
    detail: str | None = None


def _current() -> Settings:
    base_url, source = resolve_money_manager_base_url()
    return Settings(money_manager_base_url=base_url, source=source)


@router.get("")
def read_settings() -> Settings:
    return _current()


@router.put("")
def update_settings(update: SettingsUpdate) -> Settings:
    try:
        base_url = settings_store.normalize_base_url(update.money_manager_base_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    settings = settings_store.load()
    settings.money_manager_base_url = base_url
    settings_store.save(settings)
    log.info("Saved Money Manager address %s", base_url)
    return _current()


@router.get("/status")
async def connection_status() -> ConnectionStatus:
    base_url, _ = resolve_money_manager_base_url()
    if not base_url:
        return ConnectionStatus(configured=False, reachable=False, money_manager_base_url=None)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{base_url}/moneyBook/getInitData")
            response.raise_for_status()
    except httpx.HTTPError:
        log.warning("Money Manager at %s is not reachable", base_url)
        return ConnectionStatus(
            configured=True,
            reachable=False,
            money_manager_base_url=base_url,
            detail=f"Couldn't reach Money Manager at {base_url}.",
        )
    return ConnectionStatus(configured=True, reachable=True, money_manager_base_url=base_url)
