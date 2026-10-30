# Receipt Pal

Snap a photo of a receipt, review the extracted fields, and send it to
Money Manager as a transaction.

## Layout

- `backend`: FastAPI backend (Python, managed with [uv](https://docs.astral.sh/uv/))
- `docs/DECISIONS.md`: running log of design decisions

## Development

```sh
cp .env.example .env

# Backend (http://localhost:8000)
cd backend
uv sync
uv run fastapi dev
```

Checks:

```sh
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
```
