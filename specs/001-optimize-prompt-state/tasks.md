# Tasks: System Prompt Optimization & Character State Management MVP

**Input**: Design documents from `/specs/001-optimize-prompt-state/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Per the constitution, every user story MUST enumerate pytest coverage and `npm run check` validation; add additional automated/UI tests when specs demand them.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Capture confirmed latency and scale targets in `specs/001-optimize-prompt-state/research.md`
- [X] T002 Compile narrative guidelines from `提示词.md` and `破甲.md` into review notes in `docs/quickstart-prompts.md`

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 Create migration for `opening_line` column and `character_chat_states` table in `backend/migrations/013_add_opening_line_and_state.py`
- [X] T004 Implement opening-line backfill command in `backend/scripts/backfill_opening_lines.py`
- [X] T005 Update SQLAlchemy models for Character and CharacterChatState in `backend/models.py`
- [X] T006 Extend Pydantic schemas for character and chat state payloads in `backend/schemas.py`
- [X] T007 Document API contract adjustments in `specs/001-optimize-prompt-state/contracts/openapi.md`

## Phase 3: User Story 1 - Cache character opening line (Priority: P1) 🎯 MVP

**Goal**: Ensure character opening lines are generated once and reused to cut Gemini token spend.

**Independent Test**: Create/update a character, start two chats, and confirm the second chat uses the cached opening line without a fresh Gemini call (log token usage).

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T008 [P] [US1] Add pytest coverage for opening-line generation and reuse in `backend/tests/services/test_character_opening_line.py`
- [X] T009 [P] [US1] Capture manual validation steps for token savings in `specs/001-optimize-prompt-state/quickstart.md`

### Implementation for User Story 1

- [X] T010 [P] [US1] Update character lifecycle logic to persist opening_line in `backend/services/character_service.py`
- [X] T011 [US1] Adjust FastAPI character routes to return regeneration header in `backend/routes/characters.py`
- [X] T012 [US1] Surface cached opening line when starting chats in `client/src/pages/chats.tsx`
- [X] T013 [US1] Log opening-line reuse analytics in `backend/services/ai_service.py`

## Phase 4: User Story 2 - Maintain character state (Priority: P1)

**Goal**: Persist per-chat state so prompts remain coherent after history truncation.

**Independent Test**: Run pytest scenario that initializes state, updates keys across turns, truncates history, and verifies state injection into subsequent prompts.

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T014 [P] [US2] Add state manager unit tests in `backend/tests/services/test_character_state_manager.py`
- [X] T015 [P] [US2] Add integration test covering state persistence flow in `backend/tests/services/test_character_state_manager.py`

### Implementation for User Story 2

- [X] T016 [P] [US2] Introduce CharacterStateManager service in `backend/services/character_state_manager.py`
- [X] T017 [US2] Wire state retrieval and updates into AI prompt builder in `backend/services/ai_service.py`
- [X] T018 [US2] Expose chat state endpoints in `backend/routes/chats.py`
- [X] T019 [US2] Handle state snapshot metadata in message responses via `backend/services/gemini_service_new.py`
- [X] T020 [US2] Initialize default state during chat creation in `backend/services/character_service.py`

## Phase 5: User Story 3 - Improve system prompt guidance (Priority: P2)

**Goal**: Refresh SAFE and NSFW system prompts to enforce narrative quality while honoring Gemini safety policies.

**Independent Test**: Execute SAFE and NSFW scripted conversations, confirming guideline adherence and safety pass rate documented in quickstart.

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T021 [P] [US3] Document SAFE/NSFW prompt QA checklist in `specs/001-optimize-prompt-state/quickstart.md`
- [X] T022 [P] [US3] Capture safety refusal baseline comparison in `docs/quality-reports/prompt-safety.md`

### Implementation for User Story 3

- [X] T023 [US3] Rewrite NSFW system prompt with consolidated rules in `backend/prompts/system.py`
- [X] T024 [US3] Align SAFE system prompt with structured guidelines in `backend/prompts/system_safe.py`
- [X] T025 [US3] Ensure prompt loader applies new instruction blocks in `backend/services/gemini_service_new.py`
- [X] T026 [US3] Update prompt reference documentation in `docs/quickstart-prompts.md`

## Phase N: Polish & Cross-Cutting Concerns

- [X] T027 [P] Update analytics script to report opening-line token savings in `backend/scripts/report_token_usage.py`
- [X] T028 Review and sanitize prompt rollback notes in `specs/001-optimize-prompt-state/quickstart.md`
- [X] T029 Run end-to-end smoke test covering chat start and long-form conversation in `backend/tests/integration/test_chat_flow.py`
- [X] T030 Compile deployment checklist including migration steps and prompt rollout in `docs/deployment/001-optimize-prompt-state.md`

## Phase 6: UX Enhancements

- [X] T031 [UX] Add collapsible chat 状态面板 styling in `client/src/components/chats/StatePanel.tsx` and integrate with assistant messages
- [X] T032 [UX] Replace static state summary with per-message 状态面板 fallback logic in `client/src/pages/chats.tsx`
- [X] T033 [UX] Show 状态面板 in dedicated chat view at `client/src/pages/chat.tsx`

## Phase 7: Prompt & State Seeding

- [X] T034 [US2] Centralize opening-line prompt builder in `backend/prompts/opening_line.py`
- [X] T035 [US2] Add safe/nsfw state initialization prompts in `backend/prompts/state_initialization*.py`
- [X] T036 [US2] Persist per-character default state and use it for chat seeding in services/models
- [X] T037 [US2] Create backfill script for character default state templates in `backend/scripts/backfill_character_state.py`

## Dependencies & Execution Order

- User Story 1 depends on Phase 1–2 completion.
- User Story 2 depends on Phase 1–2 completion and shares models established in Phase 2.
- User Story 3 depends on Phase 1–2 and leverages AI service updates from User Story 2.

## Parallel Example: User Story 2

```bash
# Parallel test development
Task: "Add state manager unit tests in backend/tests/services/test_character_state_manager.py"
Task: "Add integration test covering state persistence flow in backend/tests/routes/test_chat_state_flow.py"

# Parallel implementation
Task: "Introduce CharacterStateManager service in backend/services/character_state_manager.py"
Task: "Expose chat state endpoints in backend/routes/chats.py"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Deliver User Story 1 (opening-line caching) and validate token savings
4. Pause for QA sign-off before proceeding

### Incremental Delivery

1. Release MVP (User Story 1)
2. Add User Story 2 for state persistence once MVP stable
3. Integrate User Story 3 prompt improvements after state manager verified

### Parallel Team Strategy

- Developer A: Focuses on opening-line service updates (US1)
- Developer B: Builds CharacterStateManager and chat state endpoints (US2)
- Developer C: Refreshes system prompts and QA process (US3)

---

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
