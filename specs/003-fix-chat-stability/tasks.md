# Tasks: Chat Stability and Error Recovery

**Input**: `specs/003-fix-chat-stability/` plan, spec, research, data-model, quickstart, contracts  
**Prerequisites**: `specs/003-fix-chat-stability/plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Tests**: Targeted pytest for deterministic backend logic plus scripted manual validation in `quickstart.md` (per Constitution Principle V)  
**Organization**: Tasks grouped by user story (P1 → P2) after shared setup/foundation phases

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Parallelizable tasks (independent files / no ordering)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` per spec priorities
- Include explicit file paths in every description

## Path Conventions
- **Backend**: `backend/services/`, `backend/routes/`, `backend/schemas.py`, `backend/tests/services/`
- **Frontend**: `client/src/` (hooks, components, pages, types, contexts)
- **Docs**: `specs/003-fix-chat-stability/*.md`, `contracts/`

## Constitution Alignment Tasks
- [X] T001 Document regression transcript proving persona boundaries stay intact during error flows in `specs/003-fix-chat-stability/quickstart.md`
- [X] T002 Add explicit moderation red-team scenario covering circuit-breaker paths to `specs/003-fix-chat-stability/quickstart.md`
- [X] T003 Create PII-safe telemetry helper emitting structured logs in `backend/services/telemetry.py`
- [X] T004 Append latency and retry budget checklist to `specs/003-fix-chat-stability/quickstart.md` to enforce Principle IV
- [X] T005 Capture automated + manual test matrix for chat stability in `specs/003-fix-chat-stability/quickstart.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Document environment toggles needed before implementation starts.

- [X] T006 Add `PGBOUNCER_DISABLE_CACHE` and debug failure header guidance to `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ensure backend configuration detects PgBouncer and exposes toggles for downstream stories.

- [X] T007 Extend `backend/config.py` with `pgbouncer_disable_cache` and `debug_force_error` settings plus docstrings
- [X] T008 Update `backend/database.py` to auto-disable asyncpg statement caches, honor `PGBOUNCER_DISABLE_CACHE`, and emit `db_pool_detected` log event

**Checkpoint**: Backend configuration ready—user stories can rely on safe connections.

---

## Phase 3: User Story 1 – Reliable AI Message Generation (Priority: P1) 🎯 MVP

**Goal**: Eliminate duplicate prepared statement errors, add bounded retries with circuit breaker, and return structured responses.  
**Independent Test**: Send concurrent chat messages (ideally via pytest + manual curl) verifying retries succeed, breaker opens after 5 forced failures, and telemetry logs contain sanitized payloads.

### Tests for User Story 1 ⚠️

- [X] T009 [P] [US1] Add `backend/tests/services/test_circuit_breaker.py` covering closed/open/half-open transitions
- [X] T010 [P] [US1] Add `backend/tests/services/test_chat_retry_logic.py` asserting retry/backoff, token deduction on success only, and error envelope fields
- [X] T011 [P] [US1] Add `backend/tests/services/test_database_pool_detection.py` verifying PgBouncer heuristics and asyncpg connect args

### Implementation for User Story 1

- [X] T012 [US1] Implement per-chat circuit breaker state machine in `backend/services/circuit_breaker.py`
- [X] T013 [US1] Refactor `backend/services/chat_service.py` to wrap AI generation with circuit breaker gating and 1s/2s/4s async backoff retries
- [X] T014 [US1] Add debug header simulation, structured error envelopes, and safe token deduction with `retry_meta` in `backend/services/chat_service.py`
- [X] T015 [US1] Wire telemetry logging for each attempt via `backend/services/telemetry.py` inside `backend/services/chat_service.py`
- [X] T016 [US1] Update `backend/routes/chats.py` to surface success payload `retryMeta`, map error codes to HTTP statuses, and set `Retry-After` headers
- [X] T017 [US1] Define `ChatGenerationSuccess` / `ChatGenerationError` schemas in `backend/schemas.py` to match new contract
- [X] T018 [US1] Export new service helpers in `backend/services/__init__.py` and ensure imports stay consistent

**Checkpoint**: ChatService resilient under PgBouncer; backend returns localized, structured responses.

---

## Phase 4: User Story 2 – Graceful Error Display and Recovery (Priority: P1)

**Goal**: Show localized, actionable error states with retry/reload options without losing chat context.  
**Independent Test**: Force backend errors (via debug header) and verify the chat page surfaces specific messages (EN/ZH), retry works, and chat list stays intact.

- [X] T019 [P] [US2] Define chat generation response/error types in `client/src/types/index.ts`
- [X] T020 [US2] Create API helper wrapping fetch + error mapping in `client/src/lib/chatApi.ts`
- [X] T021 [P] [US2] Build reusable error presentation component in `client/src/components/chats/ChatErrorBanner.tsx`
- [X] T022 [US2] Add localized strings for error codes, retry CTA, and reload option in `client/src/contexts/LanguageContext.tsx`
- [X] T023 [US2] Implement resilient mutation hook with error state + retry helpers in `client/src/hooks/useChatGeneration.ts`
- [X] T024 [US2] Refactor `client/src/pages/chat.tsx` to use `useChatGeneration`, show `ChatErrorBanner`, and refresh recent chats optimistically

**Checkpoint**: Users see clear recovery paths; no generic “加载错误”.

---

## Phase 5: User Story 3 – Accurate Typing Indicators (Priority: P2)

**Goal**: Keep typing indicators truthful—start instantly, clear on success or failure, and timeout gracefully.  
**Independent Test**: Observe indicator across success, error, timeout, and breaker scenarios ensuring ≤200 ms clear time.

- [X] T025 [US3] Extend `client/src/hooks/useChatGeneration.ts` with typing indicator timers, AbortController cleanup, and 30 s timeout fallback
- [X] T026 [US3] Update `client/src/pages/chat.tsx` to sync hook indicator state, clear on success/error/timeout, and display timeout messaging
- [X] T027 [US3] Update `client/src/hooks/useRealtimeMessages.ts` to clear indicators on new assistant messages and revalidate metadata
- [X] T028 [US3] Enhance `client/src/components/ui/TypingIndicator.tsx` to support optional status text for timeout/error transitions

**Checkpoint**: Typing indicator never sticks; timeout messaging is explicit.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Validate end-to-end behaviour, ensure docs/tests/telemetry commitments are complete.

- [ ] T029 Run `pytest backend/tests/services/test_*` and record outcomes in `specs/003-fix-chat-stability/quickstart.md`
- [ ] T030 Run `npm run build` (or `npm run check`) and log results in `specs/003-fix-chat-stability/quickstart.md`
- [ ] T031 Execute full quickstart scenarios (baseline, failure, breaker, timeout, moderation) and capture transcripts + telemetry samples in `specs/003-fix-chat-stability/quickstart.md`

---

## Dependencies & Execution Order

1. Phase 1 Setup → Phase 2 Foundational  
2. Phase 2 must finish before User Stories begin (PgBouncer config required)  
3. User Story 1 (P1) enables backend reliability for downstream stories  
4. User Story 2 (P1) depends on US1 responses for error payloads  
5. User Story 3 (P2) depends on US2 hook structure and US1 response timing  
6. Polish tasks run after all user stories complete

## Parallel Example: User Story 1

```bash
# Parallelizable tasks once config ready:
- Implement circuit breaker (T012) while wiring retries (T013) and telemetry (T015)
- In parallel, update schemas/routes (T016–T017) while tests (T009–T011) guide development
```

## Implementation Strategy

1. Deliver US1 (backend resilience) as MVP to unblock production reliability.  
2. Layer US2 frontend recovery UX leveraging structured errors.  
3. Finish with US3 indicator polish and final validation per quickstart.
