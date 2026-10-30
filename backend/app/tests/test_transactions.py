import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

FORM = {
    "mbDate": "2026-10-25T00:00:00",
    "mbCash": "15819.58",
    "inOutType": "Expense",
    "inOutCode": "1",
    "payType": "Scotia Mastercard",
    "mbCategory": "Household",
    "subCategory": "Groceries",
    "mbContent": "Super Valu Fresh Foods",
    "mbDetailContent": "Purchased groceries",
    "assetId": "DB646F4A-DB7E-40EB-9FD0-BD7F0A371455",
    "mcid": "11",
    "mcscid": "F6351E1E-6127-4F58-B9C7-530DAF11FAD2",
}


def _mock_transport(handler):
    real_client = httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    return factory


def test_create_transaction_encodes_spaces_as_percent_20(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test")
    seen: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return httpx.Response(200, text="{success:true}")

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.post("/create-transaction", data=FORM)

    assert response.status_code == 200
    request = seen["request"]
    assert str(request.url) == "http://mm.test/moneyBook/create"
    assert request.headers["content-type"] == "application/x-www-form-urlencoded"
    body = request.content.decode()
    assert "mbContent=Super%20Valu%20Fresh%20Foods" in body
    assert "payType=Scotia%20Mastercard" in body
    assert "mbDate=2026-10-25T00:00:00" in body
    assert "+" not in body
