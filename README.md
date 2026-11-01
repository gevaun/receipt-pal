# Receipt Pal

Snap a photo of a receipt, review the extracted fields, and send it to
Money Manager as a transaction.

## Layout

- `backend`: FastAPI backend (Python, managed with [uv](https://docs.astral.sh/uv/))
- `web`: React + Tailwind web app (Vite, TypeScript)
- `docs`: `DECISIONS.md` (design decision log), `api.md`, `diagrams/` (Eraser and BPMN flows), `design/` (UI boards)

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

Set the Money Manager server address on the web app's Settings page. It's saved
to `backend/data/settings.json` (git-ignored) and survives restarts;
`MONEY_MANAGER_BASE_URL` in `.env` is only used when nothing has been saved.

Receipt scanning in the web app currently replays a sample receipt; the Gemini
extraction endpoint isn't built yet (see `web/src/lib/extract.ts`).

Checks:

```sh
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd web && npm run build
```
