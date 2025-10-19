# Data Model – Chat Stability & Error Recovery

Defines the runtime entities, state objects, and validation rules introduced or modified for resilient chat generation.

---

## 1. Circuit Breaker State (Backend, In-Memory)

Tracks resiliency status per chat conversation. Stored in-process; no database persistence.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `chat_key` | `str` | Unique identifier (`chat.uuid` string) | Required |
| `state` | `Literal['closed','open','half_open']` | Current breaker state | Required |
| `failures` | `int` | Consecutive failure count since last success | `0 <= failures <= max_failures` |
| `last_failure_at` | `float` (monotonic seconds) | Timestamp of most recent failure | Optional; `None` when never failed |
| `next_attempt` | `float | None` | Monotonic deadline when half-open probe allowed | Required when `state=='open'` |
| `lock` | `asyncio.Lock` | Ensures atomic state transitions across tasks | Created lazily per chat |

### State Transitions

```
Closed --(failure >=5)--> Open
Open --(monotonic() >= next_attempt)--> HalfOpen
HalfOpen --(success)--> Closed
HalfOpen --(failure)--> Open (reset next_attempt = now + 30s)
```

### Validation
- `failures` resets to `0` on `after_success`.
- `next_attempt` must be `None` unless `state == 'open'`.
- Breaker context is removed if chat deleted (cleanup hook in `ChatService`).

---

## 2. Retry Context (Backend)

Encapsulates retry attempt metadata passed between ChatService layers for logging and response shaping.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `attempt` | `int` | Attempt number starting at 1 | `1 <= attempt <= 3` |
| `max_attempts` | `int` | Fixed at 3 | Constant |
| `backoff_seconds` | `float` | Sleep duration before next retry (1, 2, 4) | Derived |
| `exception` | `Exception | None` | Last encountered exception | Optional |
| `duration_ms` | `float` | Time spent on attempt | Calculated for telemetry |

Response payload (JSON) attaches `retryMeta: { attempts: 2, maxAttempts: 3, nextAllowedAt: ISO8601 | null }`.

---

## 3. Error Envelope (Backend → Frontend Contract)

Standardized error structure returned by `POST /api/chats/{id}/generate`.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `code` | `Literal['database_error','timeout','rate_limit','breaker_open','moderation_blocked','unknown']` | Machine-readable category | `"database_error"` |
| `messageKey` | `string` | Localization key for LanguageContext | `"chat.error.database"` |
| `details` | `dict[str, Any]` | Optional structured data (e.g., `{"statement":"__asyncpg_stmt_17__"}`) | `{}` |
| `retryAfterSeconds` | `int | None` | Seconds until retry allowed (breaker, rate limit) | `30` |
| `requestId` | `string` | Correlates logs with client error | `"chat-uuid:attempt-3"` |

HTTP status codes:
- `400` user-triggered (validation, moderation)
- `402` insufficient tokens (existing behaviour)
- `429` rate limit (SlowAPI)
- `503` breaker open / dependency failure
- `504` timeout (client or server)

---

## 4. Frontend Chat Error State

TypeScript discriminated union stored in React state/hook.

```typescript
type ChatErrorState =
  | { status: 'idle' }
  | {
      status: 'error';
      payload: ChatErrorPayload;
      appearedAt: number; // epoch ms
      retriable: boolean;
    };

interface ChatErrorPayload {
  code: 'database_error' | 'timeout' | 'rate_limit' | 'breaker_open' | 'moderation_blocked' | 'network';
  messageKey: string;               // e.g., 'chat.error.timeout'
  retryAfterSeconds?: number;       // for breaker/rate-limit countdowns
  requestId?: string;
}
```

Rules:
- `ChatErrorBanner` displays when `status === 'error'`.
- `retryAfterSeconds` drives disabled state for retry button and countdown label.
- Errors auto-dismiss after successful retry or manual close.

---

## 5. Typing Indicator Timer (Frontend)

Ensures 200ms clear SLA regardless of outcome.

| Field | Type | Description |
|-------|------|-------------|
| `chatUuid` | `string` | Current chat identifier |
| `active` | `boolean` | Indicator visible flag |
| `startedAt` | `number` | `performance.now()` when indicator shown |
| `clearTimeoutId` | `ReturnType<typeof setTimeout> | null` | Timer to auto-clear after 30s timeout |
| `abortController` | `AbortController | null` | Cancels fetch when leaving page |

Behaviour:
- On `useChatGeneration.send`, set `active=true`, schedule `clearTimeoutId` for 30s.
- On success/error/timeout, clear indicator immediately and cancel timer.
- `useEffect` cleanup cancels timer + abort controller on unmount/navigation.

---

## 6. Telemetry Event Schema

Structured log emitted for each generation attempt (success or failure).

| Field | Type | Description |
|-------|------|-------------|
| `event` | `"chat_generation_attempt"` | Static |
| `chat_id` | `int` | Internal numeric ID |
| `chat_uuid` | `string` | UUID for correlation |
| `user_id` | `int` | Actor ID (no email/PII) |
| `character_id` | `int` | Persona reference |
| `breaker_state` | `string` | `"closed"`, `"open"`, `"half_open"` |
| `attempt` | `int` | Attempt number |
| `latency_ms` | `float` | Duration |
| `result` | `"success"`/`"failure"` | Outcome |
| `error_code` | `string | None` | Matches error envelope |
| `retry_after_seconds` | `int | None` | Provided when breaker open |

Logs feed Principle IV observability commitments.

---

## 7. Recent Chats Optimistic Cache Entry (Frontend)

Extends existing `EnrichedChat` to allow optimistic timestamp updates.

| Field | Type | Notes |
|-------|------|-------|
| `optimistic` | `boolean | undefined` | `true` when item injected client-side before server confirmation |
| `pendingMessageId` | `number | null` | Temporary identifier to reconcile after success |

On rollback, entries with `optimistic=true` and matching `pendingMessageId` are removed.

---

## Cleanup & Persistence Notes

- Circuit breaker stores reside in memory; on process restart all breakers reset to `closed`. Documented in plan & quickstart.
- Error states and typing timers are per-component and reset on navigation; no persistence.
- Telemetry events stored in existing logging infrastructure (no schema change).
