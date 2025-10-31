# Data Model: System Prompt Optimization & Character State Management MVP

## Character (existing – amended)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| id | UUID / int (existing) | Database | Primary key (unchanged) |
| name | text | Existing | Required |
| description | text | Existing | Drives opening line + state initialization |
| opening_line | text (nullable) | **New** | Cached conversational opener generated on create/update; backfilled for legacy characters |
| updated_at | timestamp | Existing | Triggers opening_line regeneration when description meaningfully changes |

**Validation & Behaviors**
- opening_line generated once per character mutation and reused for every chat start.
- Regeneration triggered when description diff exceeds threshold (service logic).
- UI reflects cached value without blocking on new Gemini call.

## CharacterChatState (new)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| chat_id | integer | FK → chats.id | Primary key; one state row per chat |
| state_json | JSON/text | Service-managed | Stores keys: `胸部`, `下体`, `衣服`, `姿势`, `情绪`, `环境`; localized strings preserved |
| updated_at | timestamp | DB default | Auto-updated on each write |

**Validation & Behaviors**
- Only predefined keys persisted; extra keys rejected.
- Create-on-demand: initialized at first chat prompt assembly using character description defaults.
- Merge semantics: service deep-merges incoming updates, retaining previous keys when absent.

## System Prompt Variants (SAFE / NSFW)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| prompt_id | string | File path (`backend/prompts/system*.py`) | Identifier for SAFE vs NSFW |
| instruction_blocks | ordered list | Curated text | Contains nine rule buckets: scene structure, pacing, sensory detail, vocabulary variety, emotional continuity, environment detail, safety fallback, character consistency, progression control |

**Validation & Behaviors**
- Prompt files version-controlled; QA sign-off required before deployment.
- Instructions reference state placeholders (`[当前状态: ...]`) to reinforce continuity.
- SAFE variant omits explicit references while keeping structure/quality rules.

## Relationships & State Transitions

- Character ↔ Chats: unchanged; new opening_line read path for chat creation.
- Chats ↔ CharacterChatState: 1:1; state created when chat first invokes prompt assembly.
- Character state lifecycle:
  1. Initialize via `CharacterStateManager.initialize_state`.
  2. Update via `update_state` after each LLM turn (LLM-provided delta).
  3. Retrieve via `get_state` when building next prompt.
- Backfill: migration runs to add `opening_line`; background job or on-demand service call populates missing lines before first use.
