import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

GEMINI_REPLY = {
    "merchant": "Super Valu Fresh Foods",
    "date": "2026-10-18",
    "amount": 12206.19,
    "description": "Groceries: 3x Gatorade, eggs, cheese, yogurt and 9 other items",
    "lines": [
        {"kind": "title", "text": "SUPER VALU"},
        {"kind": "row", "left": "Purity Whole Wheat Bread", "right": "575.00"},
        {"kind": "rule"},
        {"kind": "row", "left": "TOTAL", "right": "12206.19", "strong": True},
    ],
}


def _mock_transport(handler):
    real_client = httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    return factory


def _gemini_response(payload: dict) -> httpx.Response:
    text = json.dumps(payload)
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


def _upload(content_type: str = "image/jpeg") -> dict:
    return {"image": ("receipt.jpg", b"fake-jpeg-bytes", content_type)}


def test_extract_receipt_sends_known_merchants_and_returns_extraction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.delenv("LLM_MODEL", raising=False)
    seen: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return _gemini_response(GEMINI_REPLY)

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.post(
        "/extract-receipt",
        files=_upload(),
        data={"merchants": ["Super Valu", "Pharmacy Plus"]},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["merchant"] == "Super Valu Fresh Foods"
    assert result["date"] == "2026-10-18"
    assert result["amount"] == 12206.19
    assert result["description"] == GEMINI_REPLY["description"]
    assert [line["kind"] for line in result["lines"]] == ["title", "row", "rule", "row"]
    assert result["lines"][3]["strong"] is True
    request = seen["request"]
    assert str(request.url).endswith("/models/gemini-2.5-flash:generateContent")
    assert request.headers["x-goog-api-key"] == "test-key"
    body = json.loads(request.content)
    prompt = body["contents"][0]["parts"][0]["text"]
    assert '"Super Valu", "Pharmacy Plus"' in prompt
    assert body["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/jpeg"
    assert body["generationConfig"]["responseMimeType"] == "application/json"


def test_extract_receipt_reports_missing_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    response = client.post("/extract-receipt", files=_upload())

    assert response.status_code == 500
    assert "LLM_API_KEY" in response.json()["detail"]


def test_extract_receipt_rejects_non_images(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")

    response = client.post("/extract-receipt", files=_upload("application/pdf"))

    assert response.status_code == 415


def test_extract_receipt_maps_gemini_failures_to_502(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "quota"}})

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.post("/extract-receipt", files=_upload())

    assert response.status_code == 502


def test_extract_receipt_rejects_unreadable_model_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    bad = {**GEMINI_REPLY, "date": "18 Oct 2026"}

    def handler(request: httpx.Request) -> httpx.Response:
        return _gemini_response(bad)

    monkeypatch.setattr(httpx, "AsyncClient", _mock_transport(handler))

    response = client.post("/extract-receipt", files=_upload())

    assert response.status_code == 502
