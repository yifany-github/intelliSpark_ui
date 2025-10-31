# Deployment Checklist: System Prompt Optimization & Character State Management

1. **Database Migration**
   - Apply `backend/migrations/013_add_opening_line_and_state.py`.
   - Verify `character_chat_states` table creation and `characters.opening_line` column.

2. **Backfill & Data Prep**
   - Run `python backend/scripts/backfill_opening_lines.py` with appropriate batch size.
   - Spot-check a few characters to confirm `opening_line` populated.

3. **Prompt Assets**
   - Deploy updated `backend/prompts/system.py` and `backend/prompts/system_safe.py`.
   - Share `docs/quickstart-prompts.md` with QA for review sign-off.

4. **Application Verification**
   - Execute `pytest tests/services/test_character_state_manager.py tests/services/test_character_opening_line.py`.
   - Run smoke test `pytest tests/integration/test_chat_flow.py`.
   - Run `npm run check` for frontend type safety.

5. **Manual QA**
   - Follow quickstart Step 4–6 (state endpoints, SAFE/NSFW scripts, token report).
   - Record safety refusal deltas in `docs/quality-reports/prompt-safety.md`.

6. **Analytics Update**
   - Capture baseline data if missing via `python backend/scripts/report_token_usage.py --baseline <value>`.

7. **Rollback Plan**
   - Keep a copy of legacy prompt files for quick revert.
   - Ready command to downgrade migration if necessary.
