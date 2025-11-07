# Repository Guidelines

## Project Structure & Module Organization
- `client/src` hosts the React UI: feature entries in `pages`, shared UI primitives in `components/ui`, and reusable hooks or contexts under their namespaced folders using the `@/...` alias.
- `backend/` delivers the FastAPI service with request handlers in `routes/`, business logic in `services/`, and shared models and serializers in `models.py` and `schemas.py`.
- Tests live in `backend/tests/<feature>/`; deployment helpers and reusable prompt assets live in `scripts/`, `build-prod.sh`, Docker files at the root, and `backend/prompts/`.

## Build, Test, and Development Commands
- `npm install` / `pip install -r backend/requirements.txt` install dependencies for the web client and API.
- `npm run dev` serves Vite on port 5173; `cd backend && uvicorn main:app --reload` (or `python main.py`) starts the API on port 8000.
- `npm run build` creates the production bundle; `npm run check` runs TypeScript type checks before commits.
- `cd backend && pytest` executes unit and integration tests; reserve `./build-prod.sh` or `docker-compose up` for release validation.

## Coding Style & Naming Conventions
- TypeScript follows 2-space indentation, ES module imports, PascalCase component files, and camelCase hooks, contexts, and utilities.
- Tailwind classes stay ordered layout → spacing → color; shared tokens or primitives belong in `client/src/components/ui`.
- Python code is PEP 8 compliant with 4-space indentation; keep FastAPI routes thin and delegate logic to `services/` to aid testing.

## Testing Guidelines
- Pytest drives backend coverage; place tests in `backend/tests/<feature>/test_<module>.py` and mirror the module under test.
- Reuse fixtures from `backend/tests/conftest.py`; extend them instead of duplicating database, auth, or storage setup.
- Run `pytest` before pushing and add focused integration checks whenever service contracts change.

## Commit & Pull Request Guidelines
- Use `<type>(scope): summary` commit messages, e.g., `feat(chats): add streaming endpoint`, matching the existing history.
- Keep PRs tightly scoped, link issues, attach screenshots or `curl` traces for UI/API changes, and confirm `npm run build` plus `pytest` pass locally.

## Security & Configuration Tips
- Copy `.env.example` to `.env` at the root and to `backend/.env`; never commit secrets or production credentials.
- When adjusting aliases or design tokens, update `tailwind.config.ts`, `components.json`, and `vite.config.ts` together to avoid build regressions.

## Architecture Overview
- The React client calls FastAPI endpoints under `/routes`, sharing contract types defined in `backend/schemas.py`.
- Prompt-based features should place reusable content in `backend/prompts/` so updates stay centralized.

## Active Technologies
- TypeScript (React 18) / Python ≥3.8 (FastAPI) + React, Tailwind CSS, React Query, FastAPI, SQLAlchemy, Supabase, Stripe, Gemini (001-optimize-prompt-state)
- SQLite (dev) / PostgreSQL (prod) (001-optimize-prompt-state)

## Recent Changes
- 001-optimize-prompt-state: Added TypeScript (React 18) / Python ≥3.8 (FastAPI) + React, Tailwind CSS, React Query, FastAPI, SQLAlchemy, Supabase, Stripe, Gemini
