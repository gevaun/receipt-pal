import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _mock_transport(handler):
    real_client = httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    return factory


def test_settings_empty_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MONEY_MANAGER_BASE_URL", raising=False)

    response = client.get("/settings")

    assert response.status_code == 200
    assert response.json() == {"money_manager_base_url": None, "source": None}


def test_settings_fall_back_to_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://env.test:8888/")

    response = client.get("/settings")

    assert response.json() == {"money_manager_base_url": "http://env.test:8888", "source": "env"}


@pytest.mark.parametrize(
    ("entered", "saved"),
    [
        ("192.168.100.203:8888", "http://192.168.100.203:8888"),
        ("  http://192.168.100.203:8888/  ", "http://192.168.100.203:8888"),
        ("https://mm.local", "https://mm.local"),
    ],
)
def test_update_settings_normalizes_and_persists(
    isolated_settings_file: Path, entered: str, saved: str
) -> None:
    response = client.put("/settings", json={"money_manager_base_url": entered})

    assert response.status_code == 200
    assert response.json() == {"money_manager_base_url": saved, "source": "file"}
    assert json.loads(isolated_settings_file.read_text()) == {"money_manager_base_url": saved}


@pytest.mark.parametrize(
    "entered", ["", "   ", "ftp://192.168.1.2", "192.168.1.2:99999", "1.2.3.4:88?x=1"]
)
def test_update_settings_rejects_invalid_address(
    isolated_settings_file: Path, entered: str
) -> None:
    response = client.put("/settings", json={"money_manager_base_url": entered})

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert not isolated_settings_file.exists()


def test_saved_address_overrides_env_for_upstream_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://env.test")
    client.put("/settings", json={"money_manager_base_url": "192.168.100.203:8888"})
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json={})

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.get("/get-initial-data")

    assert response.status_code == 200
    assert seen["url"] == "http://192.168.100.203:8888/moneyBook/getInitData"


def test_unreadable_settings_file_is_ignored(
    isolated_settings_file: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("MONEY_MANAGER_BASE_URL", raising=False)
    isolated_settings_file.write_text("{not json")

    response = client.get("/settings")

    assert response.json() == {"money_manager_base_url": None, "source": None}


def test_status_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MONEY_MANAGER_BASE_URL", raising=False)

    response = client.get("/settings/status")

    assert response.json() == {
        "configured": False,
        "reachable": False,
        "money_manager_base_url": None,
        "detail": None,
    }


def test_status_reachable(monkeypatch: pytest.MonkeyPatch) -> None:
    client.put("/settings", json={"money_manager_base_url": "192.168.100.203:8888"})
    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(lambda request: httpx.Response(200)))

    response = client.get("/settings/status")

    assert response.json()["reachable"] is True


def test_status_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    client.put("/settings", json={"money_manager_base_url": "192.168.100.203:8888"})

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused", request=request)

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    body = client.get("/settings/status").json()

    assert body["configured"] is True
    assert body["reachable"] is False
    assert "192.168.100.203:8888" in body["detail"]
