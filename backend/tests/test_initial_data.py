import logging

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


def test_initial_data_proxies_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test/moneyBook/")

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "http://mm.test/moneyBook/getInitData"
        return httpx.Response(200, json={"accounts": [], "categories": []})

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.get("/get-initial-data")
    assert response.status_code == 200
    assert response.json() == {"accounts": [], "categories": []}


def test_initial_data_upstream_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test/moneyBook")
    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(lambda request: httpx.Response(500)))

    response = client.get("/get-initial-data")
    assert response.status_code == 502


def test_initial_data_missing_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MONEY_MANAGER_BASE_URL", raising=False)

    response = client.get("/get-initial-data")
    assert response.status_code == 500


def test_initial_data_request_failure_logs_traceback(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.ERROR, logger="app.money_manager.router")
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test/moneyBook")

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused", request=request)

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.get("/get-initial-data")

    assert response.status_code == 502
    record = next(record for record in caplog.records if record.name == "app.money_manager.router")
    assert record.exc_info is not None
    assert "Failed to request initial data" in record.message


def test_initial_data_invalid_response_logs_traceback(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.ERROR, logger="app.money_manager.router")
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test/moneyBook")
    monkeypatch.setattr(
        httpx, "AsyncClient", _mock_transport(lambda request: httpx.Response(200, text="invalid"))
    )

    response = client.get("/get-initial-data")

    assert response.status_code == 502
    assert response.json() == {"detail": "Failed to parse initial data"}
    record = next(record for record in caplog.records if record.name == "app.money_manager.router")
    assert record.exc_info is not None
    assert "Failed to parse initial data" in record.message
