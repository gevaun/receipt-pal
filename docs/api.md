# Receipt Pal API

FastAPI service that proxies the [Money Manager](https://realbyteapps.com/) app's web interface and normalizes responses to JSON. Routes live in `backend/app/api/routes/` and are registered in `backend/app/api/main.py` (no path prefix). Interactive docs are served by FastAPI at `/docs` and the schema at `/openapi.json`.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `MONEY_MANAGER_BASE_URL` | Yes (for money-manager routes) | Base URL of the Money Manager server. A trailing `/` is stripped. Loaded from the environment / `.env`. |

If unset, money-manager routes return `500` with `{"detail": "MONEY_MANAGER_BASE_URL is not set"}`.

There is no authentication on this API. Upstream requests use a 10 s timeout.

## Error format

All errors use FastAPI's shape: `{"detail": "<message>"}`.

| Status | Detail | Cause |
|--------|--------|-------|
| 422 | (FastAPI validation errors) | Missing/invalid query parameters |
| 500 | `MONEY_MANAGER_BASE_URL is not set` | Server misconfigured |
| 502 | `Failed to fetch initial data` / `Failed to fetch transactions` | Upstream returned non-2xx, or network error/timeout |
| 502 | `Failed to parse initial data` / `Failed to parse transactions` | Upstream response was not parseable |

---

## `GET /health`

Liveness check. Tag: `health`. Does not contact Money Manager.

**Response 200**

```json
{"status": "ok"}
```

---

## `GET /get-initial-data`

Fetches Money Manager's initial data (accounts/assets, categories, and other lookup data used by the UI). Tag: `money-manager`.

- Upstream: `GET {MONEY_MANAGER_BASE_URL}/moneyBook/getInitData`
- Parameters: none
- Upstream body is JSON5-ish (not strict JSON); it is parsed with `json5` and returned as regular JSON. The shape is passed through **unmodified** from Money Manager, so its schema is defined upstream.

**Response 200**: the parsed upstream object (arbitrary JSON object).

**Errors**: 500, 502 (see above).

Useful for resolving IDs (e.g. `asset_id`, category IDs) used by transaction rows.

---

## `GET /get-transactions`

Fetches transactions for a date range. Tag: `money-manager`.

- Upstream: `GET {MONEY_MANAGER_BASE_URL}/moneyBook/getDataByPeriod`
- Upstream returns XML (`<dataset>`); it is converted to JSON.

**Query parameters**

| Name | Type | Required | Maps to upstream | Description |
|------|------|----------|------------------|-------------|
| `start_date` | string | Yes | `startDate` | Start of range. Passed through as-is (not validated); use the format Money Manager expects, e.g. `2026-10-01`. |
| `end_date` | string | Yes | `endDate` | End of range, same format. |
| `mbid` | integer | No | `mbid` | Money book entry ID filter. |
| `asset_id` | string | No | `assetId` | Restrict to an account/asset. |
| `_dc` | string | No | `_dc` | Cache-buster passed through (ExtJS convention). Safe to omit. |

Omitted optional parameters are not sent upstream.

**Response 200**

```json
{
  "results": 2,
  "rows": [
    {"<xmlTag>": "<text>", "...": "..."}
  ]
}
```

- `results`: integer count from the upstream `<results>` element; falls back to `len(rows)` if absent.
- `rows`: one object per upstream `<row>`. Keys are the row's child XML tag names (as provided by Money Manager) and **all values are strings** (empty string when the element is empty). No type coercion is performed.

**Example**

```
GET /get-transactions?start_date=2026-10-01&end_date=2026-10-31
```

**Errors**: 422, 500, 502 (see above).

---

## Notes for a future MCP server

Suggested tool mapping:

| Tool | Route | Notes |
|------|-------|-------|
| `get_initial_data` | `GET /get-initial-data` | No arguments. |
| `get_transactions` | `GET /get-transactions` | Required: `start_date`, `end_date`. Optional: `mbid`, `asset_id`. Omit `_dc`. |
| (health check) | `GET /health` | Optional. |

Row values are untyped strings, so tools should convert amounts/dates as needed.

Keep this document updated whenever routes in `backend/app/api/routes/` change.
