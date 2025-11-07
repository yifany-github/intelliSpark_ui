# Implementation Plan: System Prompt Optimization & Character State Management MVP

**Branch**: `001-optimize-prompt-state` | **Date**: 2025-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-optimize-prompt-state/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Improve conversation quality and continuity by (1) caching curated character opening lines to cut Gemini token spend, (2) persisting per-chat character state so prompts stay coherent after history truncation, and (3) refreshing SAFE/NSFW system prompts with codified narrative guidelines drawn from `提示词.md` and `破甲.md`.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (React 18) / Python ≥3.8 (FastAPI)  
**Primary Dependencies**: React, Tailwind CSS, React Query, FastAPI, SQLAlchemy, Supabase, Stripe, Gemini  
**Storage**: SQLite (dev) / PostgreSQL (prod)  
**Testing**: `npm run check`, `cd backend && pytest`  
**Target Platform**: Web client (Vite) + FastAPI service  
**Project Type**: Web (frontend + backend)  
**Performance Goals**: Opening line cache hit ≤1.0s; prompt regeneration with state injection ≤1.5s  
**Constraints**: Supabase auth, Stripe billing, Gemini token quotas & safety policies  
**Scale/Scope**: 5k daily chats (peak 200 concurrent) using stateful prompts

## Constitution Check

*Gate: confirm the plan satisfies each principle before research; re-validate after Phase 1 design.*

- **Unified Client-Server Contracts**: Migrations add `opening_line` column and `character_chat_states` table; schemas/models/tests updated together; shared client types extended if UI surfaces cached content.
- **Composable UI System**: Chats page reuses existing toast/dialog primitives; no new UI primitives planned—confirm reuse before coding.
- **Service-Layer Backend Discipline**: Character and AI services own new logic; FastAPI routes stay thin wrappers calling services and schemas.
- **Test-Gated Delivery**: Pytest coverage for caching and state manager; scripted manual validation for prompt quality plus `npm run check` as merge gate.
- **Secrets & Prompt Stewardship**: Prompt updates live in `backend/prompts`; rollout notes capture safety review and rollback path for prompt regressions.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
backend/
├── routes/
├── services/
├── models.py
├── schemas.py
└── tests/

client/
├── src/
│   ├── components/
│   │   └── ui/
│   ├── pages/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   └── types/
└── public/

specs/
└── <feature-id>/
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    ├── contracts/
    └── tasks.md
```

**Structure Decision**: All work confined to existing `backend` services/routes/models/prompts and `client/src/pages/chats` consumption; new feature docs live under `specs/001-optimize-prompt-state/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |

## Phase 0 – Research & Clarification

**Objectives**
- Resolve performance expectations for chat initialization and prompt regeneration latency.
- Confirm target scale (daily chat volume) to size caching/state persistence effort.
- Consolidate guidance from `提示词.md` and `破甲.md` into actionable prompt rules.

**Planned Tasks**
- Interview product/ops to establish acceptable latency (opening line reuse ≤1.0s, prompt rebuild ≤1.5s) and document in research.
- Analyze usage analytics to estimate daily active chats (goal: support 5k chats/day with state tracking enabled).
- Extract non-negotiable storytelling guidelines from reference docs and classify them by SAFE/NSFW prompt variant.
- Compare Gemini safety best practices for explicit content to ensure prompt tweaks stay within policy.

**Outputs**
- `/specs/001-optimize-prompt-state/research.md` capturing decisions, rationale, and alternatives.
- Updated Technical Context fields replacing NEEDS CLARIFICATION values.
- Constitution Gate check confirming no blockers remain before design.

## Phase 1 – Design, Data Model & Contracts

**Objectives**
- Model DB changes for `opening_line` and `character_chat_states`.
- Define service responsibilities and API contracts covering opening-line lifecycle and state management.
- Describe SAFE/NSFW prompt structure updates without leaking implementation details.

**Planned Tasks**
- Produce `data-model.md` summarizing Character and CharacterChatState fields, validation, and relationships.
- Draft migration outline (Alembic) noting backfill strategy for existing characters.
- Document REST contract adjustments (character create/update, chat prompt generation hooks) in `/specs/001-optimize-prompt-state/contracts/`.
- Outline manual/automated validation flow in `quickstart.md` (pytest suites, `npm run check`, qualitative prompt review).
- Run `.specify/scripts/bash/update-agent-context.sh codex` to add new technologies/processes for future agents.

**Outputs**
- `data-model.md`
- `contracts/` artifacts (OpenAPI snippets or structured descriptions)
- `quickstart.md`
- Updated agent context file per script
- Constitution Check re-run showing compliance post-design

## Constitution Compliance (Post-Design)

- **Unified Client-Server Contracts**: Migration outline plus `openapi.md` ensure schemas, models, and API docs evolve together; frontend relies on existing chat components consuming enriched responses.
- **Composable UI System**: No new primitives introduced; chats page leverages current UI kit.
- **Service-Layer Backend Discipline**: Character and AI services encapsulate caching/state logic; routes remain orchestration only.
- **Test-Gated Delivery**: Plan mandates targeted pytest modules, token analytics script, and `npm run check` gate before merge.
- **Secrets & Prompt Stewardship**: Prompt changes confined to versioned files with rollback/QA steps documented in quickstart.

## Phase 2 – Implementation & Task Breakdown (preview)

**Objectives**
- Prepare for `/speckit.tasks` by identifying major implementation slices aligned with user stories.

**Planned Focus**
- Opening-line caching (migration, service logic, UI consumption)
- Character state manager services and prompt integration
- SAFE/NSFW prompt copy refresh with safety validation loop
- Testing strategy (pytest modules, qualitative reviews, token usage comparison)

*Detailed task list deferred to `/speckit.tasks` after this plan is review-ready.*
