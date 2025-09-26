# Repository Guidelines

## Project Structure & Module Organization
- `client/src` contains the React UI; feature folders under `pages`, `components`, `contexts`, and `hooks` reuse utilities via the `@/...` alias from `tsconfig.json`.
- `backend/` hosts the FastAPI service layer with `routes/`, `services/`, `models.py`, `schemas.py`, and prompt assets in `prompts/`.
- Tests live in `backend/tests` with settings in `backend/pytest.ini`; deployment helpers reside in `scripts/`, `docker-compose.yml`, and the repo Dockerfiles.

## Build, Test, and Development Commands
- `npm install` syncs frontend packages; `pip install -r backend/requirements.txt` prepares the API.
- `npm run dev` starts Vite on :5173; run `cd backend && python main.py` or `uvicorn main:app --reload` for FastAPI on :8000.
- `npm run build` creates a production bundle; `npm run check` runs TypeScript type checks; `cd backend && pytest` executes backend unit and integration tests.
- Use `./build-prod.sh` or `docker-compose up` only when validating containerized deployments.

## Coding Style & Naming Conventions
- Frontend TypeScript and TSX use 2-space indentation, ES module imports, PascalCase component files, and camelCase hooks, contexts, and utilities.
- Tailwind utility classes should stay ordered layout -> spacing -> color, mirroring existing components; shared primitives live in `client/src/components/ui`.
- Python modules follow PEP 8 with 4-space indentation; keep FastAPI routes thin and delegate logic to the `services/` layer.

## Testing Guidelines
- Prefer pytest for backend coverage; colocate new tests under `backend/tests/<feature>/` and mirror module names (`test_<module>.py`).
- Reuse fixtures in `backend/tests/conftest.py` for database or auth setup; extend them instead of rebuilding setup code.
- For frontend changes that touch APIs, add contract checks or story fixtures and verify via `npm run dev` while monitoring server logs.

## Commit & Pull Request Guidelines
- Recent history mixes conventional commits (`feat(chats): ...`, `chore: ...`) with ad hoc messages; default to `<type>(scope): summary` for clarity.
- Scope PRs narrowly, link issues, and include screenshots or curl responses when UX or API behavior changes.
- Note environment prerequisites in PR descriptions (`.env`, `backend/.env`) and confirm `npm run build` plus `pytest` pass locally before requesting review.

## Environment & Configuration Tips
- Copy `.env.example` values into root `.env` and `backend/.env` before running services and keep secrets untracked.
- Update `tailwind.config.ts`, `components.json`, and `vite.config.ts` together when adding design tokens or aliases to avoid build regressions.
