# Quickstart: System Prompt Optimization & Character State Management MVP

## Prerequisites
- Backend virtualenv with `pip install -r backend/requirements.txt`
- Frontend dependencies via `npm install`
- Local `.env` and `backend/.env` populated with Supabase, Stripe, and Gemini keys
- Alembic migrations ready to run locally

## Step-by-Step Validation

1. **Apply database migration**
   ```bash
   cd backend
   alembic upgrade head
   ```
   - Confirms `characters.opening_line` column and `character_chat_states` table exist.

2. **Backfill opening lines for existing characters**
   ```bash
   python scripts/backfill_opening_lines.py --limit 50
   ```
   - Observe logs for Gemini failures; rerun if necessary.

3. **Run automated tests**
   ```bash
   cd backend
   pytest tests/services/test_character_state_manager.py tests/services/test_character_opening_line.py tests/integration/test_chat_flow.py
   cd ..
   npm run check
   ```
   - Ensures core services and TypeScript contracts stay green.

4. **Manual chat flow QA**
   - Create a new character in admin UI; confirm opening line appears instantly when starting a chat.
   - Trigger state changes over 30+ turns; verify clothing/emotion continuity from `state_snapshot` in API logs.
   - Inspect `/api/chats/{id}/state` response to ensure keys remain within approved set.
   - POST updates to `/api/chats/{id}/state` and confirm merged values persist and appear in subsequent `state_snapshot` payloads.

5. **Prompt quality review**
   - For SAFE and NSFW archetypes, run scripted conversations (see `docs/quickstart-prompts.md` if available).
   - Confirm responses follow scene structure, include sensory detail, and avoid repetitive vocabulary.
   - Record any Gemini safety refusals; the total must stay within +5% of baseline.

6. **Token usage comparison**
   - Execute analytics script:
     ```bash
     python scripts/report_token_usage.py --window 7d --metric opening_line
     ```
   - Validate ≥50% reduction in initialization tokens relative to pre-feature baseline.

## Rollback Plan
- Restore `backend/prompts/system.py` 与 `backend/prompts/system_safe.py` 为部署前版本。
- Downgrade migration (drop `character_chat_states`, remove `opening_line` column) if needed.
- Flush cached opening lines via management command to ensure old logic resumes cleanly.
