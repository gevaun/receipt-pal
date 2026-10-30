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


def test_update_transaction_sends_id_and_empty_asset_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test")
    seen: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return httpx.Response(200, text="{success:true}")

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    form = {
        **FORM,
        "id": "BCA919B9-D909-4BEF-8547-827BDC5FD98E",
        "inOutType": "Exp.",
        "toAssetId": "",
        "targetAssetId": "",
    }
    response = client.post("/update-transaction", data=form)

    assert response.status_code == 200
    request = seen["request"]
    assert str(request.url) == "http://mm.test/moneyBook/update"
    body = request.content.decode()
    assert body.startswith("id=BCA919B9-D909-4BEF-8547-827BDC5FD98E&")
    assert "toAssetId=&targetAssetId=&" in body
    assert "mbContent=Super%20Valu%20Fresh%20Foods" in body
    assert "inOutType=Exp." in body
    assert "+" not in body


def test_create_transaction_accepts_guid_category_and_empty_note(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test")
    seen: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return httpx.Response(200, text="{success:true}")

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    form = {**FORM, "mcid": "619F363B-6AAB-4B7A-B4D4-6DAF37FB6603", "mbDetailContent": ""}
    response = client.post("/create-transaction", data=form)

    assert response.status_code == 200
    body = seen["request"].content.decode()
    assert "mcid=619F363B-6AAB-4B7A-B4D4-6DAF37FB6603" in body
    assert "mbDetailContent=&" in body


def test_update_transaction_upstream_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test")
    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(lambda request: httpx.Response(500)))

    response = client.post("/update-transaction", data={**FORM, "id": "abc"})

    assert response.status_code == 502
    assert response.json() == {"detail": "Failed to update transaction"}


@pytest.mark.parametrize(
    ("ids", "expected_body"),
    [
        (
            ["BCA919B9-D909-4BEF-8547-827BDC5FD98E"],
            "ids=%3ABCA919B9-D909-4BEF-8547-827BDC5FD98E",
        ),
        (
            [
                "A4AFAE13-48B7-4176-9522-E99D48E06104",
                "B66EED65-FE19-4FB3-8F15-9C2BB67A3016",
                "00EFCD26-7E93-41A3-A26B-B15607A968A4",
                "A55CBFE4-3B2D-4524-ABEA-76B205C5CB7C",
            ],
            "ids=%3AA4AFAE13-48B7-4176-9522-E99D48E06104"
            "%3AB66EED65-FE19-4FB3-8F15-9C2BB67A3016"
            "%3A00EFCD26-7E93-41A3-A26B-B15607A968A4"
            "%3AA55CBFE4-3B2D-4524-ABEA-76B205C5CB7C",
        ),
    ],
)
def test_delete_transactions_joins_ids(
    monkeypatch: pytest.MonkeyPatch, ids: list[str], expected_body: str
) -> None:
    monkeypatch.setenv("MONEY_MANAGER_BASE_URL", "http://mm.test")
    seen: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return httpx.Response(200, text="{success:true}")

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.post("/delete-transactions", data={"ids": ids})

    assert response.status_code == 200
    request = seen["request"]
    assert str(request.url) == "http://mm.test/moneyBook/delete"
    assert request.content.decode() == expected_body


def test_delete_transactions_requires_ids() -> None:
    response = client.post("/delete-transactions", data={})

    assert response.status_code == 422
