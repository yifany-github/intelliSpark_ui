# Feature Specification: System Prompt Optimization & Character State Management MVP

**Feature Branch**: `feature/issue-129-remove-complexity`  
**Created**: 2025-10-28  
**Status**: Draft  
**Input**: User description: "I am currently on a feature branch for issue 129. i want to also solve the issue 251 on this branch as well. Can you help? issue 251"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cache character opening line (Priority: P1)

Character creators want the app to remember a curated opening line so that each new conversation starts consistently without burning extra model tokens.

**Why this priority**: Reduces cost and load on Gemini while giving users a consistent narrative entry point.

**Independent Test**: Run a manual test: create or update a character, start two chats, and confirm the second chat reuses the stored opening line without a fresh LLM call; verify through token usage logs.

**Acceptance Scenarios**:

1. **Given** a character with no cached opening line, **When** the character is saved, **Then** the system generates and stores a new opening line that appears in the next chat.
2. **Given** a character with an existing opening line, **When** a user starts a new chat, **Then** the cached opening line is reused and no additional model call is made during chat initialization.

---

### User Story 2 - Maintain character state (Priority: P1)

Chat participants need scenes to stay coherent, so the system must persist character state across long conversations even when history truncation occurs.

**Why this priority**: Prevents immersion-breaking continuity errors that drive users away.

**Independent Test**: Automated integration test: run `pytest` scenario that creates a chat, updates state fields (e.g., clothing, emotion), truncates older messages, and confirms subsequent prompts still reference the stored state.

**Acceptance Scenarios**:

1. **Given** an active chat, **When** a state update is submitted, **Then** the stored JSON reflects the new values and a timestamp refreshes.
2. **Given** an existing chat with stored state, **When** the next prompt is assembled, **Then** the current state is injected ahead of the conversation transcript.

---

### User Story 3 - Improve system prompt guidance (Priority: P2)

Story designers expect higher-quality, safety-compliant responses that reflect house writing standards.

**Why this priority**: Enhances narrative quality while maintaining compliance with Gemini safety policies.

**Independent Test**: Manual review: run sample NSFW and SAFE conversations and confirm prompts follow the new structure; capture `npm run check` plus reviewer sign-off documenting quality improvements and zero new safety blocks.

**Acceptance Scenarios**:

1. **Given** a SAFE character session, **When** responses are generated, **Then** the output reflects structured scene progression and passes Gemini moderation.
2. **Given** an NSFW character session, **When** the conversation escalates, **Then** vocabulary variation and emotional layering follow the reference guidelines without triggering additional safety refusals.

---

### Edge Cases

- Character import scripts encounter existing records; the system must backfill opening lines without duplicating prompts.
- Chats that predate the new state table should initialize a default state the first time continuity checks run.
- Safety filters may still block some NSFW outputs; the prompt should instruct graceful fallback messaging instead of silent failures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose opening-line lifecycle via `backend/routes/characters.py`, delegating persistence to `backend/services/character_service.py`.
- **FR-002**: System MUST validate opening-line data through `backend/schemas.py` so that UI and service layers share a single contract.
- **FR-003**: Chat prompt assembly MUST consume state data through a dedicated service in `backend/services/ai_service.py` and inject it before history replay.
- **FR-004**: Client experience MUST acknowledge cached opening lines in `client/src/pages/chats` and display them without additional latency.
- **FR-005**: Prompt updates MUST align with content guidelines sourced from `提示词.md` and `破甲.md`, ensuring SAFE and NSFW variants remain consistent.
- **FR-006**: State updates MUST record audit-friendly timestamps and ensure only defined state keys (`胸部`, `下体`, `衣服`, `姿势`, `情绪`, `环境`) are persisted.

### Key Entities *(include if feature involves data)*

- **Character**: Adds an optional `opening_line` attribute tied to records defined in `backend/models.py`; synchronized with character creation and edits.
- **CharacterChatState**: Represents per-chat JSON state aligned with `backend/models.py` and consumed by AI services; stores current continuity context and `updated_at`.
- **SystemPrompt Variant**: Business-owned content stored in `backend/prompts/` (SAFE vs NSFW) referencing house writing guidelines.

## Assumptions

- Gemini token accounting is available so the team can demonstrate reduced consumption during QA.
- Existing moderators will validate that updated prompts stay within acceptable safety thresholds.
- Issue #129 simplifications are already merged into the working branch.

## Dependencies

- Requires reads from `提示词.md` and `破甲.md` to be up to date so the prompt copy reflects the latest standards.
- Requires database migration tooling to be available as part of the standard deployment workflow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Average tokens spent on initializing new chats drop by at least 50% compared with the baseline captured before release.
- **SC-002**: 95% of long-form chats (≥30 user turns) maintain consistent clothing and posture descriptions during QA review.
- **SC-003**: 90% of sampled conversations receive a quality rating of 4/5 or better from internal reviewers after the prompt refresh.
- **SC-004**: Gemini safety refusal rate does not increase by more than 5 percentage points across SAFE and NSFW test suites.
