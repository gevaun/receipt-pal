# Receipt Pal

Snap a photo of a receipt, review the extracted fields, and send it to
Money Manager as a transaction.

## Layout

- `backend`: FastAPI backend (Python, managed with [uv](https://docs.astral.sh/uv/))
- `web`: React + Tailwind web app (Vite, TypeScript)
- `docs/DECISIONS.md`: running log of design decisions

## Development

```sh
cp .env.example .env

# Backend (http://localhost:8000)
cd backend
uv sync
uv run fastapi dev

# Web app (http://localhost:5173), proxies /api to the backend
cd ../web
npm install
npm run dev
```

Receipt scanning in the web app currently replays a sample receipt; the Gemini
extraction endpoint isn't built yet (see `web/src/lib/extract.ts`).

Checks:

```sh
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd web && npm run build
```
