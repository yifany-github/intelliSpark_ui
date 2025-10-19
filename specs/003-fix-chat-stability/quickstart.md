# Quickstart – Chat Stability & Error Recovery Validation

Use this guide to manually validate the resilient chat pipeline once implementation is complete. Steps assume a local development setup with `settings.debug = True`.

---

## 1. Prerequisites

1. **Environment**  
   ```bash
   # Terminal 1 – backend
   cd backend
   export PGBOUNCER_DISABLE_CACHE=false  # Ensure caches stay disabled
   uvicorn main:app --reload

   # Terminal 2 – frontend
   npm run dev
   ```
   Backend should log `db_pool_detected` event confirming PgBouncer detection.

2. **Test Accounts & Data**  
   - Ensure Supabase auth user exists with token balance sufficient for chats.
   - Seed at least one character in `backend/prompts/characters` or via admin UI.

3. **Tools**  
   - Browser (Chrome/Edge) with DevTools.
   - `curl` (for direct API checks).
   - Optional: `jq` for pretty JSON output.

---

## 2. Baseline Success Flow

Goal: Verify chat works end-to-end without errors and meets latency budget.

1. Navigate to `http://localhost:5173/chat` and open an existing chat.  
2. Open DevTools → Network tab; clear previous entries.  
3. Send "你好，今天过得怎么样？" (or English equivalent).  
4. Observe typing indicator:
   - Appears immediately and clears when response arrives (≤200 ms after completion).  
5. Confirm response arrives within expected latency:
   - First token/stream update within 1 s (check Network timing).  
6. Inspect console/logs:
   - No errors; backend logs `chat_generation_attempt` with `"result":"success"`.

**Pass Criteria**
- Message appears in conversation history.
- Recent chats list updates within 500 ms (watch sidebar).
- `chat_generation_attempt` log includes `latency_ms` and `breaker_state="closed"`.

---

## 3. Simulated Database Failure & Retry

Goal: Ensure localized error copy appears and retry succeeds without page refresh.

1. In a new terminal, trigger failure via dev header:
   ```bash
   curl -X POST "http://localhost:8000/api/chats/<CHAT_UUID>/generate" \
     -H "Authorization: Bearer <JWT>" \
     -H "X-Debug-Force-Error: duplicate_statement" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Response should include:
   ```json
   {
     "error": {
       "code": "database_error",
       "messageKey": "chat.error.database",
       "retryAfterSeconds": null
     }
   }
   ```
2. In the browser, send another message.  
3. Observe:
   - `ChatErrorBanner` appears with localized copy (Chinese/English) describing database issue.  
   - Retry button enabled immediately.
4. Click **Retry**; message should succeed on second attempt.

**Pass Criteria**
- Typing indicator clears within 200 ms after error.
- Retry success banner/log appears; backend logs show two attempts (`attempt:1` failure, `attempt:2` success).
- Conversation history remains intact; no duplicate user message.

---

## 4. Circuit Breaker Behaviour

Goal: Confirm breaker opens after repeated failures and half-open probe works.

1. Fire 5 consecutive forced failures to same chat (use loop):
   ```bash
   for i in {1..5}; do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST "http://localhost:8000/api/chats/<CHAT_UUID>/generate" \
       -H "Authorization: Bearer <JWT>" \
       -H "X-Debug-Force-Error: duplicate_statement" \
       -H "Content-Type: application/json" \
       -d '{}'
   done
   ```
2. Send a message from the browser.
   - Should immediately display breaker error with countdown (retry disabled).
   - Response payload contains `retryAfterSeconds` (~30).
3. Wait 30 s; send message again.
   - Half-open probe should run once; if success, breaker resets and chat resumes.

**Pass Criteria**
- Backend log shows breaker transition events (`state":"open"` then `"state":"half_open"` then `"state":"closed"`).  
- Frontend countdown updates every second and buttons enable once window expires.  
- After successful probe, `breaker_state` returns to `"closed"`.

---

## 5. Timeout UX

Goal: Confirm 30 s timeout surfaces correct messaging and clears indicator.

1. Trigger backend timeout simulation:
   ```bash
   curl -X POST "http://localhost:8000/api/chats/<CHAT_UUID>/generate" \
     -H "Authorization: Bearer <JWT>" \
     -H "X-Debug-Force-Error: timeout" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
2. In browser, send a message and let it run for 30 s.
   - Typing indicator clears automatically; banner displays timeout copy with retry link.
3. Click **Reload chat** to refetch conversation without refreshing entire page.

**Pass Criteria**
- Error banner uses `chat.error.timeout` text (verify Chinese/English).  
- `Reload chat` invalidates and refetches `/api/chats/<uuid>/messages`.  
- Retrying afterwards succeeds and hides error state.

---

## 6. Moderation Regression (Safety Gate)

Goal: Ensure retries do not bypass moderation pipeline.

1. (Optional but recommended) Open the circuit breaker first by running the failure loop in Section 4 so the chat is in `open` state.
2. Send content expected to be rejected (e.g., explicit NSFW prompt) from chat UI.
3. Observe:
   - Error banner displays moderation warning (localized).  
   - Retry button disabled; instructions direct user to adjust message.
4. Attempt to retry via API with debug header (should still fail, even while breaker is open/half-open).

**Pass Criteria**
- Backend response carries `code: "moderation_blocked"`; no retries performed.  
- Chat history unaffected; user message not persisted.

---

## 7. Recent Chats Optimistic Update Verification

1. Pin browser console log for `queryClient` operations (optional instrumentation).
2. Send user message and immediate follow-up to confirm recent chats list updates without waiting for server.
3. Force failure (database error) and verify optimistic entry rolls back (no phantom last message).

**Pass Criteria**
- `recent chats` panel updates instantly on success; rolls back on failure.  
- No stale titles or stuck typing indicators remain after retries.

---

## 8. Persona Regression Transcript (Immersive Roleplay Integrity)

Goal: Prove characters stay in-universe—even when errors occur.

1. Start a chat with a lore-heavy persona (e.g., 皇家宫廷角色) and send an in-character opener.
2. Trigger a forced database error using the debug header loop (Section 3) while continuing dialog.
3. After recovery, capture a transcript snippet:
   - **Prompt**: user line that should receive an in-character reply
   - **AI Response**: ensure tone, boundaries, and safety rules remain intact
   - **Observation**: confirm no meta/system leakage despite retries/breaker events
4. Record transcript in `docs/regression/persona-chat-stability.md` (create if needed) with timestamp and character name.

**Pass Criteria**
- Persona voice and safety boundaries unchanged before/after error.
- Transcript stored for future regressions.

---

## 9. Observability & Budget Checklists

### Latency & Retry Budget
- [ ] First-token latency ≤ 1 s p95 (measure via Network tab).
- [ ] Total response latency ≤ 30 s (timeout) with retry envelope logged.
- [ ] Retry attempts per chat ≤ 3, logged with backoff 1s/2s/4s.
- [ ] Circuit breaker open window exactly 30 s; half-open probe logged once.

### Telemetry & Logging
- [ ] Backend logs contain `chat_generation_attempt` for each attempt with correct `result` and `breaker_state`.
- [ ] Database detection log emitted once on startup (`db_pool_detected`) identifying Supabase Connect host.
- [ ] Telemetry records omit message content/PII (verify sampled entries).
- [ ] Metrics/console output show retry counts, breaker transitions, and latency budget compliance.

---

## 10. Automated & Manual Test Matrix

| Category | Test | Purpose | Location / Command | Pass Criteria |
|----------|------|---------|--------------------|---------------|
| Automated | `pytest backend/tests/services/test_circuit_breaker.py` | Validate breaker state machine & timers | `cd backend && pytest backend/tests/services/test_circuit_breaker.py` | All tests green, coverage of closed/open/half-open paths |
| Automated | `pytest backend/tests/services/test_chat_retry_logic.py` | Ensure retries/backoff + error envelopes behave deterministically | `cd backend && pytest backend/tests/services/test_chat_retry_logic.py` | Retries capped, tokens deducted once, error codes mapped |
| Automated | `pytest backend/tests/services/test_database_pool_detection.py` | Guard asyncpg config against Supabase Connect regressions | `cd backend && pytest backend/tests/services/test_database_pool_detection.py` | Detection heuristics pass for Supabase URLs |
| Manual | Baseline success flow (Section 2) | Confirm healthy chat latency & response | Quickstart Section 2 | Meets latency/typing criteria |
| Manual | Failure + retry recovery (Section 3) | Verify localized error banners & retry success | Quickstart Section 3 | Retry works, logs show attempt sequence |
| Manual | Circuit breaker (Section 4) | Observe open/half-open cycle & countdown UI | Quickstart Section 4 | Countdown + single probe succeed |
| Manual | Timeout UX (Section 5) | Ensure indicator clears & timeout banner shows actions | Quickstart Section 5 | Typing clears ≤200 ms, reload works |
| Manual | Moderation regression (Section 6) | Confirm guardrails block NSFW even during breaker events | Quickstart Section 6 | Error shows moderation message, no retries |
| Manual | Persona regression transcript (Section 8) | Preserve immersive voice after faults | Section 8 + transcript doc | Transcript captured, persona consistent |

---

## 11. Cleanup

1. Stop backend/front-end processes.
2. If debug header was used, inspect logs for warning entries indicating use.  
3. Reset any environment overrides (`unset PGBOUNCER_DISABLE_CACHE`).

---

Completion of all sections demonstrates compliance with Success Criteria SC-001 – SC-008 and Constitution gates (Principles II, IV, V).
