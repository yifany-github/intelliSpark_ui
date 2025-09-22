# Repository Guidelines

## Project Structure & Module Organization
- `client/src` contains the Vite UI. Use `components/` for reusable pieces, `pages/` for routed screens, `hooks/` for shared state, `services/` for API clients, and centralize shared types in `types/`.
- `backend/` provides the FastAPI service, with request handlers in `routes/`, orchestration in `services/` and `story_engine/`, and data contracts in `schemas.py`, `models.py`, and `database.py`. Tests live under `backend/tests/`.
- Operational assets reside in `docs/`, `scripts/`, and `attached_assets/`. Environment variables load from `.env` (frontend) and `backend/.env`; keep secrets out of version control.

## Build, Test, and Development Commands
- Install dependencies using `npm install` at the repo root and `pip install -r backend/requirements.txt` in `backend/`.
- Start the UI with `npm run dev`. Build production assets via `npm run build`, preview them with `npm run preview`, and perform type checking through `npm run check`.
- Run the API locally using `cd backend && python main.py`; `uvicorn backend.main:app --reload` is optional for hot reload.
- Execute backend tests with `cd backend && pytest`.

## Coding Style & Naming Conventions
- TypeScript files use two-space indentation. Name components and files in PascalCase, export hooks as `useCamelCase`, and keep helpers in `camelCase`. Group related UI logic near its page or feature folder.
- Tailwind classes follow the existing layout → spacing → color order. Prefer extracting variants with the `class-variance-authority` utilities already in use.
- Python code keeps four-space indentation, snake_case functions, and PascalCase Pydantic models. Perform validation in `schemas.py` and reuse utilities from `backend/utils/`.

## Testing Guidelines
- Backend tests rely on pytest with modules named `test_*.py`. Reuse fixtures from `backend/tests/conftest.py`, mock external APIs, and verify both success and failure branches before merging.
- A front-end suite is not yet committed; when adding one, prefer Vitest with React Testing Library and colocate specs as `ComponentName.test.tsx` beside the component.

## Commit & Pull Request Guidelines
- Follow the Conventional Commits style seen in history (`feat:`, `fix:`, `chore:`) and reference issue numbers in parentheses when relevant.
- Pull requests should include a clear summary, command results (`pytest`, `npm run check`), screenshots for UI changes, and call out schema or configuration updates that downstream teams must apply.

## Environment & Configuration Tips
- Declare new configuration keys in `client/src/config/` or `backend/config.py`, update `README.md`, and load real values through `.env.local` or secret managers.
- Remove temporary credentials before review.
