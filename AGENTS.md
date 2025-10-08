# Repository Guidelines

## Project Structure & Module Organization
- `client/src` contains the React UI. Feature code sits under `pages`, `components`, `contexts`, and `hooks`, reusing shared utilities via the `@/...` alias from `tsconfig.json`.
- `backend/` houses the FastAPI service with `routes/`, `services/`, `models.py`, `schemas.py`, and reusable prompt assets in `prompts/`.
- Tests live in `backend/tests` with pytest settings in `backend/pytest.ini`; deployment helpers reside in `scripts/`, `docker-compose.yml`, and the root Dockerfiles.

## Build, Test, and Development Commands
- `npm install` / `pip install -r backend/requirements.txt` set up frontend and backend dependencies.
- `npm run dev` starts Vite on :5173; run `cd backend && uvicorn main:app --reload` (or `python main.py`) for the API on :8000.
- `npm run build` produces the production bundle; `npm run check` runs TypeScript type checks.
- `cd backend && pytest` executes backend unit and integration tests; prefer `./build-prod.sh` or `docker-compose up` only for release validation.

## Coding Style & Naming Conventions
- Frontend TypeScript uses 2-space indentation, ES module imports, PascalCase component files, and camelCase hooks, contexts, and utilities.
- Tailwind classes stay ordered layout → spacing → color, matching existing components; shared primitives belong in `client/src/components/ui`.
- Python follows PEP 8 with 4-space indentation. Keep FastAPI routes thin and delegate logic to `services/`.

## Testing Guidelines
- Pytest is the primary framework; place new tests under `backend/tests/<feature>/` using `test_<module>.py` naming.
- Reuse fixtures from `backend/tests/conftest.py` for database or auth setup, extending them as needed instead of duplicating setup code.
- Run `pytest` before pushing; add focused integration checks when changing service logic.

## Commit & Pull Request Guidelines
- Follow `<type>(scope): summary` commit messages (e.g., `feat(chats): add streaming endpoint`), aligning with existing history.
- Keep PRs scoped tightly, reference related issues, include screenshots or `curl` snippets for UX/API changes, and confirm `npm run build` plus `pytest` pass locally.

## Security & Configuration Tips
- Copy `.env.example` into root `.env` and `backend/.env` before running services; keep secrets out of version control.
- When adjusting design tokens or aliases, update `tailwind.config.ts`, `components.json`, and `vite.config.ts` together to avoid build regressions.
