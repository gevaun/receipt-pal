import logging
import os
import threading
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import BaseModel

log = logging.getLogger(__name__)

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "settings.json"

_write_lock = threading.Lock()


class StoredSettings(BaseModel):
    money_manager_base_url: str | None = None


def settings_path() -> Path:
    return Path(os.getenv("RECEIPT_PAL_SETTINGS_FILE") or DEFAULT_PATH)


def load() -> StoredSettings:
    path = settings_path()
    try:
        return StoredSettings.model_validate_json(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return StoredSettings()
    except ValueError:
        log.exception("Ignoring unreadable settings file %s", path)
        return StoredSettings()


def save(settings: StoredSettings) -> None:
    path = settings_path()
    with _write_lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f"{path.name}.tmp")
        tmp.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
        os.replace(tmp, path)


def normalize_base_url(raw: str) -> str:
    value = raw.strip()
    if not value:
        raise ValueError("Enter the Money Manager address, e.g. 192.168.1.20:8888")
    if "://" not in value:
        value = f"http://{value}"
    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError("Enter an address like 192.168.1.20:8888")
    try:
        _ = parts.port
    except ValueError as exc:
        raise ValueError("The port must be a number from 1 to 65535") from exc
    if parts.query or parts.fragment:
        raise ValueError("Enter just the address, without ? or # parts")
    return f"{parts.scheme}://{parts.netloc}{parts.path}".rstrip("/")
