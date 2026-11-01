# Decisions

A running log of design decisions. Newest last.

## 1. Monorepo with the backend in `backend`

The repo is laid out as a monorepo so other apps can be added later. For now it
contains only the backend service.

## 2. FastAPI + uv

Python suits the LLM and validation work (Pydantic). uv manages dependencies and
the lockfile; linting and formatting use ruff.

## 3. LLM access through a configurable model string

`LLM_MODEL` and `LLM_API_KEY` come from the environment so the model can be
swapped without code changes.
