# Receipt Pal

A companion to Money Manager that aims to make tracking expenses as simple as photographing a receipt.

## Why Receipt Pal?

Budgeting apps like Monarch Money and Copilot Money can connect to many US bank accounts and automatically import transactions. That convenience is less accessible in Jamaica, where local bank integrations with these apps are limited. Some subscription-based budgeting tools also offer receipt scanning, but a subscription of around JMD $2,000 a month can be a steep price to pay for managing a budget.

I've used Money Manager for years. It's a great app for tracking expenses on a phone, and its PC Manager feature lets you start a server in the app and manage transactions from another device on the network. The part I wanted to improve was the manual work: take a picture of a receipt, extract the expense details, review them, and add the transaction to Money Manager.

Receipt Pal is an attempt to bridge that gap. It provides a web interface for Money Manager today, with AI-powered receipt extraction planned to make expense entry easier.

## Project status

**Receipt scanning is a demo, not AI extraction yet.** The scan screen accepts an image but always replays the same sample receipt; it does not read or upload the image. Review the fields carefully: saving from the demo creates a real transaction in Money Manager. The image is not attached to the transaction.

Currently, Receipt Pal can:

- Connect to Money Manager's PC Manager on your local network.
- View monthly spending, recent expenses, and category breakdowns.
- Search and filter transactions, and create, edit, or delete expenses.
- Preview the planned receipt-to-expense workflow using sample data.

The intended workflow is to photograph or upload a receipt, use AI to extract its details, review and correct the result, and then save it to Money Manager. The extraction service has not been implemented yet.

## How it works

The React web app talks to a FastAPI backend, which communicates with Money Manager's PC Manager. In development, Vite proxies requests from the web app to the backend. Money Manager remains the source of the transaction data; Receipt Pal does not connect directly to your bank.

- **Web:** React, TypeScript, Vite, and Tailwind CSS.
- **Backend:** Python, FastAPI, and HTTPX, with dependencies managed by [uv](https://docs.astral.sh/uv/).
- **Integration:** Money Manager's PC Manager, reachable over the local network.

## Getting started

### Prerequisites

- Money Manager with PC Manager available on your phone.
- Python 3.12 or newer and [uv](https://docs.astral.sh/uv/getting-started/installation/).
- Node.js and npm. CI uses Node.js 24.
- A network connection between the computer running the backend and your phone, typically the same Wi-Fi network.

### Run locally

From the project root, start the backend:

```sh
cd backend
uv sync
uv run fastapi dev
```

In a second terminal, start the web app:

```sh
cd web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The backend runs at [http://localhost:8000](http://localhost:8000), with interactive API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

### Connect Money Manager

1. Start PC Manager in Money Manager on your phone.
2. In Receipt Pal, open **Settings** and enter the server address shown on your phone, including the port.
3. Save the address and check the connection. If it fails, make sure PC Manager is running and the backend can reach your phone on the network.

The address is saved in `backend/data/settings.json` and persists across restarts. Alternatively, set `MONEY_MANAGER_BASE_URL` in the backend environment as a fallback; a saved address takes precedence. Set `RECEIPT_PAL_SETTINGS_FILE` to use a different settings-file path.

Account, category, subcategory, and merchant choices are currently derived from expenses in the previous 365 days. Choices not represented in that history may not be available when entering an expense.

## Development

```text
backend/    FastAPI application and tests
web/        React web application
```

The Vite development server proxies `/api` to `http://localhost:8000`. Set `API_URL` in the Vite process environment to use a different backend. A production web server and API proxy are not configured in this repository.

Run the backend checks from `backend/`:

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest app/tests
```

Run the web checks from `web/`:

```sh
npm run typecheck
npm run build
```

## Security

The backend does not currently implement authentication or authorization, and its endpoints can change Money Manager transactions and connection settings. Run it only on a trusted network; do not expose it publicly without adding appropriate protection.
