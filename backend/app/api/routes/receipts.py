import base64
import logging
import os
from typing import Annotated, Any, Literal

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

router = APIRouter(tags=["receipts"])
log = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

PROMPT = """You are reading a photo of a store receipt for a personal expense tracker.
Return only JSON that matches the schema.

- merchant: the store name. If the store is one of these known merchants, return that known name
  exactly, ignoring case, spacing and branch names: {known}. Otherwise return the store name as
  printed, tidied up.
- date: the purchase date as YYYY-MM-DD.
- amount: the final total the customer paid, including tax and fees, as a plain number.
- description: a short note of what was bought, the way someone would write it in a personal
  budget app. Write it yourself in everyday words. Do not copy item names from the receipt, and
  leave out brands, codes, sizes and prices. Name at most about six kinds of item, showing a
  quantity for repeats, then count the rest. For example, a grocery receipt with three yogurts,
  eggs, milk, bread and 14 other things becomes "Groceries: 3x yogurt, eggs, milk, bread and 14
  other items". A shipping or delivery charge, a fee or a service is described by what it was for,
  for example "Shipping fee". Keep it under 120 characters.
- lines: the receipt printed top to bottom, one entry per printed line, so it can be replayed.
  Use kind "title" for the store name and "small" for address or footer text, with the words in
  text. Use kind "rule" for a separator line. Use kind "row" for an item or total line, with the
  item text in left and its amount in right. Set strong to true for the grand total. Copy item
  names and amounts as printed.
"""

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "merchant": {"type": "STRING"},
        "date": {"type": "STRING", "description": "Purchase date as YYYY-MM-DD"},
        "amount": {"type": "NUMBER", "description": "Final total paid"},
        "description": {"type": "STRING"},
        "lines": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "kind": {"type": "STRING", "enum": ["title", "small", "rule", "row"]},
                    "text": {"type": "STRING"},
                    "left": {"type": "STRING"},
                    "right": {"type": "STRING"},
                    "strong": {"type": "BOOLEAN"},
                },
                "required": ["kind"],
            },
        },
    },
    "required": ["merchant", "date", "amount", "description", "lines"],
}


class ReceiptLine(BaseModel):
    kind: Literal["title", "small", "rule", "row"]
    text: str = ""
    left: str = ""
    right: str = ""
    strong: bool = False


class ReceiptExtraction(BaseModel):
    merchant: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    amount: float = Field(ge=0)
    description: str
    lines: list[ReceiptLine]


def _gemini_body(image: bytes, mime_type: str, known: list[str]) -> dict[str, Any]:
    prompt = PROMPT.format(known=", ".join(f'"{name}"' for name in known) or "none")
    return {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(image).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }


@router.post("/extract-receipt")
async def extract_receipt(
    image: Annotated[UploadFile, File()],
    merchants: Annotated[list[str] | None, Form()] = None,
) -> ReceiptExtraction:
    known = merchants or []
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Receipt scanning isn't set up. Add LLM_API_KEY to the backend .env file.",
        )
    mime_type = image.content_type or ""
    if not mime_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Upload a photo of a receipt.")
    data = await image.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="That photo is larger than 10 MB.")

    model = os.getenv("LLM_MODEL") or DEFAULT_MODEL
    url = GEMINI_URL.format(model=model)
    log.info("Extracting receipt with %s (%d known merchants)", model, len(known))
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                json=_gemini_body(data, mime_type, known),
                headers={"x-goog-api-key": api_key},
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        log.exception("Gemini returned HTTP %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="Receipt extraction failed") from exc
    except httpx.RequestError as exc:
        log.exception("Failed to reach Gemini")
        raise HTTPException(status_code=502, detail="Receipt extraction failed") from exc

    try:
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return ReceiptExtraction.model_validate_json(text)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        log.exception("Gemini returned a receipt that could not be read")
        raise HTTPException(
            status_code=502, detail="Couldn't read that receipt. Try a clearer photo."
        ) from exc
