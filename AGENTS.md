# Repository Guidelines

## Project Structure & Module Organization
- `client/src` hosts the Vite-powered React app; feature code sits under `pages`, reusable UI in `components`, shared logic in `hooks` and `contexts`, all importable via the `@/...` alias defined in `tsconfig.json`.
- Frontend primitives such as buttons, inputs, and modals reside in `client/src/components/ui`; reference these before introducing new patterns.
- The FastAPI backend lives in `backend/` with routes in `routes/`, business logic in `services/`, Pydantic schemas in `schemas.py`, ORM models in `models.py`, and prompt templates in `prompts/`.
- Automated tests are located in `backend/tests` (mirrored by feature) with pytest settings in `backend/pytest.ini`; deployment helpers and scripts live at the repo root (`scripts/`, `docker-compose.yml`, `build-prod.sh`).

## Build, Test, and Development Commands
- `npm install` and `pip install -r backend/requirements.txt` align frontend and backend dependencies.
- `npm run dev` starts the Vite dev server on :5173; `cd backend && uvicorn main:app --reload` (or `python main.py`) runs FastAPI on :8000.
- `npm run build` produces the production bundle; `npm run check` enforces TypeScript type safety; `cd backend && pytest` executes backend unit and integration suites.
- Run `./build-prod.sh` or `docker-compose up` only when validating containerized builds prior to release.

## Coding Style & Naming Conventions
- TypeScript/TSX files use 2-space indentation, ES module imports, PascalCase component filenames, and camelCase hooks, contexts, and utilities.
- Keep Tailwind utility classes ordered layout → spacing → color; prefer existing tokens and primitives from `components/ui`.
- Python follows PEP 8 with 4-space indentation; keep FastAPI route handlers thin and delegate to `services/` for business rules.
- Apply provided linting and formatting scripts (`npm run check`, `pytest -q`) before opening a pull request.

## Testing Guidelines
- Use pytest for backend coverage; place new tests in `backend/tests/<feature>/test_<module>.py` and reuse fixtures from `backend/tests/conftest.py` to avoid duplicated setup.
- For frontend changes that touch APIs, run `npm run dev` alongside the API and validate interactions via browser dev tools or story fixtures.
- Capture regression tests for bug fixes and ensure data-loading paths are covered by integration tests where feasible.

## Commit & Pull Request Guidelines
- Default to conventional commit prefixes such as `feat(chats): ...`, `fix(auth): ...`, or `chore: ...`; keep scope tight and descriptive.
- Each PR should link relevant issues, summarize behavioral impact, and include screenshots or curl responses when UI or API behavior changes.
- Confirm `npm run build` and `pytest` succeed locally, note `.env` prerequisites (`.env`, `backend/.env`), and tag reviewers once CI passes.

## Environment & Configuration Tips
- Copy variables from `.env.example` into root `.env` and `backend/.env`; keep secrets out of version control.
- When adding design tokens or aliases, update `tailwind.config.ts`, `components.json`, and `vite.config.ts` together to avoid build regressions.
- Log files in `logs/` aid debugging during development; trim sensitive output before sharing.
