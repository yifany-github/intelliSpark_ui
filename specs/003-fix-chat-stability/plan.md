# Implementation Plan: Chat Stability and Error Recovery

**Branch**: `003-fix-chat-stability` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-fix-chat-stability/spec.md`

## Summary

Restore reliable chat generation by hardening the asyncpg + PgBouncer integration, introducing bounded retries and a circuit breaker around AI message generation, and surfacing localized, actionable recovery states in the React client. Backend work centers on deterministic connection detection, resilient service orchestration, and structured logging, while the frontend adds timeout-aware typing indicators, optimistic recent-chat updates, and retry flows that keep context intact.

## Technical Context

**Language/Version**: Python 3.11 (FastAPI on Uvicorn), TypeScript 5.6 + React 18, Node.js 20.x  
**Primary Dependencies**: FastAPI 0.116, SQLAlchemy 2.0 + asyncpg 0.29, Supabase Auth/Realtime, TanStack Query 5, Tailwind CSS, Google Gemini SDK  
**Storage**: PostgreSQL (Supabase) in production with PgBouncer (transaction pooling), SQLite locally; Supabase Storage for assets  
**Testing**: pytest (targeted unit/integration for connection detection, circuit breaker, logging) and scripted manual quickstart for chat UX validation (per Principle V)  
**Target Platform**: Web (React SPA) backed by FastAPI API on Linux containers + Supabase managed services  
**Project Type**: Web application (React frontend + FastAPI backend)  
**Performance Goals**:
- AI generation succeeds ≥99.5% without duplicate prepared statement errors (SC-001, SC-007)
- First token (or fallback typing message) within 1s p95; total response timeout capped at 30s (FR-006, NFR-001)
- Recent chats optimistic update within 500ms for <100 active chats (FR-008, NFR-003)
- Handle ≥50 concurrent generations without exhausting PgBouncer connections (NFR-004)
**Constraints**:
- PgBouncer in transaction/statement pooling forbids prepared statement caches (FR-001/FR-011)
- Gemini responses can take up to 30s; retries must not double-spend tokens (FR-002, FR-006)
- Moderation pipeline (`nsfw_intent_service`) must process all content despite new retry paths (Principle II)
- Frontend uses React Query mutation semantics; abort controllers required for navigation cleanup (FR-009)
**Scale/Scope**:
- ~10k chats/day across 50-100 concurrent users during peak
- Each conversation averages 15 turns; circuit breaker state retained per chat
- Multi-language UI (English/Chinese) with translation keys managed in `LanguageContext`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I – Immersive Roleplay Integrity**: No persona copy changes; quickstart will capture a regression transcript proving characters stay in-universe while surfacing new error/retry states. Prompt assets remain under `backend/prompts/` and chat history preservation is guaranteed during recovery flows.
- [x] **Principle II – Safety & Content Compliance**: Moderation stays in-line because retries/circuit breaker wrap existing services without bypassing `nsfw_intent_service`; research + quickstart will document a red-team scenario that exercises guardrails during failure recovery.
- [x] **Principle III – User Trust & Data Stewardship**: Structured logging will emit chat/user identifiers only (no message bodies); plan documents retention for any new error state caches and ensures transcript purge flows remain untouched.
- [x] **Principle IV – Responsive Experience & Reliability**: Plan introduces metrics for retry attempts, circuit breaker state, latency, and token spend; performance budgets (1s first token / 30s timeout) are captured in quickstart and logging.
- [x] **Principle V – Pragmatic Testing**: Deterministic backend logic (connection heuristics, circuit breaker state machine, recent-chat optimistic update rollback) will receive pytest coverage; UI flows rely on scripted manual validation with documented checkpoints.

## Project Structure

### Documentation (this feature)

```
specs/003-fix-chat-stability/
├── plan.md               # This file
├── research.md           # Phase 0 decisions (PgBouncer heuristics, circuit breaker pattern, React retry UX)
├── data-model.md         # Phase 1 entity/state definitions (circuit breaker state, error stores, typing indicator timers)
├── quickstart.md         # Phase 1 manual validation script (success + failure + red-team guardrail)
├── contracts/
│   └── generate-ai-response.yaml  # Updated API contract with error envelopes & retry metadata
└── checklists/
    └── requirements.md   # Existing validation remains authoritative
```

### Source Code (repository root)

```
backend/
├── database.py                     # Detect PgBouncer, set asyncpg statement cache flags, structured logging
├── services/
│   ├── chat_service.py             # Retry loop, circuit breaker integration, contextual error logging
│   ├── circuit_breaker.py          # NEW: async-safe breaker state with half-open window timers
│   ├── telemetry.py                # NEW: helper for structured log payloads + metrics counters (latency, retries)
│   └── message_service.py          # Ensure context preservation hooks (no rollback on user message)
├── routes/chats.py                 # Map backend error envelopes to HTTP responses with localization keys
├── schemas.py                      # Expand message responses with retry metadata + error payloads
└── tests/services/test_chat_resilience.py    # NEW: pytest coverage for retries, breaker transitions, logging redaction

client/
├── src/pages/chat.tsx              # Mutation refactor (abortable fetch, timeout, optimistic recent chats, retry CTA)
├── src/hooks/useChatGeneration.ts  # NEW: Encapsulate typing indicator timers, retry orchestration, circuit breaker hints
├── src/components/chats/ChatErrorBanner.tsx # NEW: Localized error surface with retry + reload controls
├── src/contexts/LanguageContext.tsx# Add i18n strings for specific error cases and retry actions
├── src/lib/chatApi.ts              # NEW: Fetch helpers returning discriminated union for success/error
└── src/components/ui/TypingIndicator.tsx     # Optional: expose imperative clear API / animation tweaks

tests/
└── backend/tests/services/test_circuit_breaker.py # Deterministic breaker unit tests
```

**Structure Decision**: Retain existing web-application split (FastAPI backend + React frontend). Changes concentrate in chat services/routes and the chat page; shared utilities (telemetry, hooks) are factored to keep duplication low. No database schema migrations required.

## Complexity Tracking

*No constitution violations expected; circuit breaker state held in-memory with documentation of limitations.*

---

## Phase 0: Research & Technical Decisions

1. **PgBouncer Detection & asyncpg Configuration**
   - Confirm recommended SQLAlchemy 2.0 patterns for disabling prepared statement caches under PgBouncer transaction/statement pooling.
   - Document heuristics (hostname match, query params, environment override) and logging expectations.
   - Output: configuration decision matrix + example code snippets for `database.py`.

2. **Asynchronous Circuit Breaker Pattern**
   - Evaluate lightweight async circuit breaker approaches (custom vs `aiobreaker`) considering dependency policy.
   - Define state machine (Closed → Open → Half-Open), timers, and thread-safety with FastAPI async workers.
   - Output: state diagram, failure thresholds, metrics to emit, and test strategy.

3. **React Query Mutation Resilience**
   - Research best practices for combining TanStack Query mutations with AbortController, timeouts, and optimistic cache updates.
   - Determine UX for retry banner + localized messaging without breaking immersion.
   - Output: hook API sketch (`useChatGeneration`), typing indicator timer behavior, error classification table.

Research deliverable: `research.md` summarizing each topic with decision, rationale, and references, clearing any residual `NEEDS CLARIFICATION` items (none remain after documentation).

## Phase 1: Design & Contracts

### Backend Architecture

1. **Connection Configuration**
   - Implement helper to detect PgBouncer/Supabase URLs (including Supabase Connect session pool hosts such as `*.supabase.co`, `*.supabase.net`, and `supabase.internal`) and set `statement_cache_size=0` plus `prepared_statement_cache_size=0` with a `db_pool_detected` log.
   - Provide optional env escape hatch (`PGBOUNCER_DISABLE_CACHE=false`) documented in research.

2. **ChatService Resilience Layer**
   - Introduce retry wrapper around token deduction + AI generation (3 attempts, 1s/2s/4s backoff) catching `asyncpg` + `SQLAlchemyError`.
   - Ensure retries respect token accounting (only deduct on success) and preserve chat context.
   - Invoke circuit breaker after 5 consecutive failures per chat; auto half-open after 30s with single probe request.

3. **Circuit Breaker Module**
   - New `services/circuit_breaker.py` storing breaker state in-process with asyncio locks.
   - Expose `before_call(chat_id)` / `after_success(chat_id)` / `after_failure(chat_id, exc)` API returning error metadata for clients.

4. **Error Envelope & Logging**
   - Standardize error payload from `ChatService` (error code, localized key, retry_after, breaker_state).
   - Update `routes/chats.py` to map errors to HTTP 429/503/500 as appropriate.
   - Emit structured log via `telemetry.py` capturing chat_id, user_id, character_id, error_code, retry_count, duration (no message content).

5. **Debug Failure Injection (Dev Only)**
   - When `settings.debug` is true, honour `X-Debug-Force-Error` (values: `duplicate_statement`, `timeout`, `breaker`) in `ChatService` to short-circuit into error paths without external chaos engineering.
   - Ensure header ignored in production by guarding with config + logging warning when used.

6. **Testing**
   - Add pytest coverage for breaker transitions, retry backoff ordering, and logging redaction.
   - Add regression test ensuring asyncpg connect args include zero caches when PgBouncer detected.

### Frontend Architecture

1. **Chat Mutation Hook**
   - Create `useChatGeneration` hook encapsulating message mutation, AbortController management, timeout (30s), and fallback to circuit breaker messaging when backend returns 503/429.
   - Manage typing indicator state via hook (start on mutate, clear on success/error/timeout, ensure 200ms clear SLA).

2. **Error Surfaces & Localization**
   - Introduce `ChatErrorBanner` component with actionable buttons (`retry`, `reload conversation`, `report issue`) and propagate localized messages via new LanguageContext keys.
   - Distinguish error types (database, network, timeout, rate limit) using error code from backend.

3. **Optimistic Recent Chats & Context Preservation**
   - On successful user message send, optimistically update `/api/chats` cache; rollback on failure.
   - Ensure retries do not duplicate messages; preserve conversation history during error flows.

4. **Cleanup & Telemetry**
   - Cancel in-flight mutation when navigating away; log client-side telemetry (console + optional analytics hook) for timeout vs breaker events.

### Documentation & Contracts

1. **API Contract**: Update `contracts/generate-ai-response.yaml` describing request, response, and standardized error shapes (including `error.code`, `error.messageKey`, `retryAfterSeconds`).
2. **Data Model**: Document breaker state, error context objects, typing indicator timers in `data-model.md`.
3. **Quickstart**: Step-by-step validation covering success, forced database failure simulation, network drop, and red-team moderation scenario (Principle II).
4. **Agent Context**: After Phase 1 files are drafted, run `.specify/scripts/bash/update-agent-context.sh codex` to sync new tech considerations.

**Gate Re-evaluation**: Once backend/frontend designs and documentation drafts are ready, reconfirm Constitution Check—particularly Principles II (moderation scenario documented) and IV (telemetry commitments) before handing off to implementation tasks.

---

## Risks & Mitigations

- **Breaker State in Memory**: Horizontal scaling would need shared storage; mitigation—document limitation and emit alert if multiple workers detected.
- **Retry Token Duplication**: If AI service partially succeeds before failure, duplicate deductions possible; mitigation—deduct tokens only after persistence succeeds, log idempotency keys.
- **Timeout UX Confusion**: For long-running generations, 30s timeout might trigger erroneously; mitigation—surface countdown and allow retry after verifying backend still processing.
- **Error Localization Debt**: Adding new keys requires translation; mitigation—batch English/Chinese strings and validate via quickstart.

## Open Questions

1. Do we need admin override to disable circuit breaker for debugging? (Gather stakeholder input during research.)
2. Should breaker state persist per chat or per character model? (Default plan: per chat; confirm with product.)
3. Is there an existing analytics sink to record retry/breaker metrics, or should we log to console only? (Confirm with ops.)

## Next Steps

1. Execute Phase 0 research and capture decisions in `research.md`.
2. Draft Phase 1 artifacts (`data-model.md`, contracts, quickstart) incorporating research outcomes.
3. Re-run Constitution Check; once satisfied, proceed to `/speckit.tasks` for implementation breakdown.
