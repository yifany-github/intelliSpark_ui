# Chat Stability & Error Recovery Research

This document records the technical decisions that unblock implementation of resilient chat generation, aligning with the ProductInsightAI constitution.

---

## 1. PgBouncer Detection & asyncpg Configuration

### Decision
Always disable asyncpg prepared-statement caches when the SQLAlchemy URL resolves to `postgresql+asyncpg://`, while logging explicit detection when PgBouncer or Supabase poolers are in use. Provide an opt-out via `PGBOUNCER_DISABLE_CACHE=false` (default) to support rare direct connections that want caching.

### Rationale
- **PgBouncer limitation**: In transaction/statement pooling modes, prepared statements are connection-bound; reusing a different physical connection causes `DuplicatePreparedStatementError`. Disabling caches fixes the clash ([PgBouncer docs](https://www.pgbouncer.org/usage.html#prepared-statements)).
- **Supabase guidance**: Supabase (Supavisor) recommends `statement_cache_size=0` for asyncpg clients under pooling; mirroring this keeps our prod defaults safe.
- **Safety net**: Explicit logging when disabling caches helps operators confirm behaviour and catch accidental enabling.

### Implementation Details

```python
# backend/database.py
from urllib.parse import urlparse, parse_qs

def _using_transaction_pool(url: str) -> bool:
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    host = (parsed.hostname or "").lower()
    hints = [
        params.get("pgbouncer", ["false"])[0] == "true",
        params.get("pool_mode", [""])[0] in {"transaction", "statement"},
        host.endswith("pgbouncer") or "supabase" in host or "supavisor" in host,
    ]
    return any(hints)

async_connect_args = {}
if ASYNC_DATABASE_URL.startswith("postgresql+asyncpg://"):
    if _using_transaction_pool(ASYNC_DATABASE_URL) or os.getenv("PGBOUNCER_DISABLE_CACHE", "false").lower() != "true":
        async_connect_args["statement_cache_size"] = 0
        async_connect_args["prepared_statement_cache_size"] = 0
    async_connect_args["ssl"] = ssl.create_default_context()
```

Log entry example:
```
{"event":"db_pool_detected","driver":"asyncpg","pgbouncer":true,"statement_cache_size":0,"prepared_cache_size":0}
```

Testing: unit test that patches `settings.database_url` with PgBouncer-like host/query and asserts connect args equal zero.

---

## 2. Asynchronous Circuit Breaker Pattern

### Decision
Implement an in-process circuit breaker keyed by `chat_id` (UUID) with thresholds `max_failures=5`, `open_timeout=30s`, and a single half-open probe. Use an asyncio lock per key to avoid race conditions across concurrent FastAPI workers.

### Rationale
- **Fine-grained scope**: Per-chat scope isolates repeated failures for one conversation (e.g., bad persona prompt) without blocking others.
- **Minimal dependencies**: Custom implementation avoids new third-party packages (`aiobreaker`) and keeps behaviour explicit for testing.
- **Alignment with FR-012**: Thresholds match spec (open after 5 failures, half-open after 30 seconds).
- **Observability**: Central module emits structured events for breaker transitions (Principle IV).

### State Machine

```
Closed --(failure count >=5)--> Open --(timer 30s)--> HalfOpen
HalfOpen --(success)--> Closed
HalfOpen --(failure)--> Open (timer reset)
```

### API Sketch

```python
# backend/services/circuit_breaker.py
class BreakerState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

@dataclass
class CircuitBreaker:
    max_failures: int = 5
    reset_timeout: float = 30.0
    _states: dict[str, BreakerContext] = field(default_factory=dict)
    _locks: dict[str, asyncio.Lock] = field(default_factory=dict)

    async def before_call(self, chat_key: str) -> BreakerStatus:
        ctx = await self._get_context(chat_key)
        if ctx.state == BreakerState.OPEN and ctx.next_attempt > monotonic():
            return BreakerStatus(blocked=True, retry_after=ctx.next_attempt - monotonic())
        if ctx.state == BreakerState.OPEN:
            ctx.state = BreakerState.HALF_OPEN
        return BreakerStatus(blocked=False, state=ctx.state)

    async def after_success(self, chat_key: str) -> None:
        ctx = await self._get_context(chat_key)
        ctx.failures = 0
        ctx.state = BreakerState.CLOSED
        ctx.next_attempt = None

    async def after_failure(self, chat_key: str) -> BreakerStatus:
        ctx = await self._get_context(chat_key)
        ctx.failures += 1
        if ctx.failures >= self.max_failures:
            ctx.state = BreakerState.OPEN
            ctx.next_attempt = monotonic() + self.reset_timeout
        return BreakerStatus(blocked=ctx.state == BreakerState.OPEN, next_attempt=ctx.next_attempt)
```

Testing: deterministic pytest verifying state transitions, half-open behaviour, and concurrency via `asyncio.gather`.

Metrics: emit `breaker.state` gauge and `breaker.events` counter for Operator dashboards/log search.

---

## 3. React Query Mutation Resilience & UX

### Decision
Wrap chat generation in a custom `useChatGeneration` hook that orchestrates:
- `useMutation` with `retry: false` and explicit manual retries to avoid double-calling backend.
- `AbortController` cancellation on navigation/unmount.
- A `Promise.race` between fetch and 30s timeout to clear typing indicator within 200ms.
- Optimistic cache updates for `/api/chats` and message list, with rollback on failure.
- Error mapping to typed objects (`{ code: 'database_error', messageKey: 'chat.error.database', retryAfterSeconds?: number }`).

### Rationale
- **Deterministic retries**: Manual control prevents TanStack Query exponential retry from conflicting with backend logic.
- **Responsive UX**: Timeout ensures typing indicator does not hang, fulfilling FR-005/FR-006/NFR-001.
- **Localization**: Error objects carry translation keys so UI can swap language without hard-coded strings.
- **Context preservation**: Optimistic update + rollback ensures conversation history intact (FR-007, FR-008).

### Hook Outline

```tsx
type ChatGenerationResult =
  | { status: 'success'; message: ChatMessage; stats: { retries: number; latencyMs: number } }
  | { status: 'error'; error: ChatErrorPayload };

export function useChatGeneration(chatUuid: string | undefined) {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController>();

  const mutation = useMutation<ChatGenerationResult, ChatErrorPayload, string>({
    mutationFn: async (content) => {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      const timeout = createTimeout(30_000);
      try {
        const response = await Promise.race([
          postChatMessage(content, controllerRef.current.signal),
          timeout.promise,
        ]);
        await invalidateCaches(queryClient, chatUuid);
        return { status: 'success', message: response.message, stats: response.stats };
      } catch (error) {
        const parsed = mapToChatError(error);
        return { status: 'error', error: parsed };
      } finally {
        timeout.cancel();
      }
    },
    retry: false,
  });

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    send: mutation.mutateAsync,
    state: mutation.status,
    lastError: mutation.data?.status === 'error' ? mutation.data.error : null,
  };
}
```

Typing indicator behaviour:
- Start indicator on `onMutate`.
- Clear in a `finally` block plus guard that ensures clear occurs even if React unmounts.
- On timeout error, surface message `chat.error.timeout` with CTA to retry.

UX deliverables: `ChatErrorBanner` uses error payload to show localized copy and `Retry`, `Reload`, `Report` buttons; quickstart documents how to trigger each path (network offline, forced 500, breaker open).

---

## 4. Moderation Regression Check (Safety Alignment)

Although no moderation code changes are planned, retry logic must not bypass filters. During implementation:
- Ensure all retries call existing `AIModelManager.generate_response`, which already invokes NSFW intent detection.
- Include red-team scenario in quickstart: send content expected to trip moderation after first attempt and confirm retries do not bypass block.

Outcome recorded in quickstart; no code change required.

---

## Decision Summary

| Topic | Outcome | Open Follow-up |
|-------|---------|----------------|
| PgBouncer detection | Disable asyncpg caches when driver=asyncpg, log detection, env override supported | Validate Supabase URL parsing against staging credentials |
| Circuit breaker | Custom per-chat breaker (`max_failures=5`, 30s reset) with asyncio locks and structured events | Document horizontal scaling limitations in README/deployment notes |
| React mutation UX | New `useChatGeneration` hook with manual retries, timeout, localized error payload | Confirm design for error banner CTA with product (refresh vs navigate) |
| Moderation check | Retain guardrails, document red-team scenario | Include scenario in quickstart to satisfy Principle II |
