# Research: System Prompt Optimization & Character State Management MVP

## Decision 1: Latency targets for chat initialization and prompt generation

- **Decision**: Cap opening-line retrieval at ≤1.0s (including cache miss generation) and full prompt regeneration with state injection at ≤1.5s.
- **Rationale**: Keeps initial response near-instant for users while leaving headroom for Gemini round-trips; aligns with conversational UX benchmarks (<2s perceived immediate response).
- **Alternatives considered**:
  - ≤0.5s targets: rejected due to variability in first-time Gemini calls and migration backfills.
  - ≤2.0s targets: too lenient; risks regressing from current experience and undermining perceived optimizations.

## Decision 2: Expected scale for stateful conversations

- **Decision**: Plan for 5,000 daily active chats using cached opening lines and state tracking, with peak concurrency of ~200 simultaneous chats.
- **Rationale**: Derived from current DAU trends shared by product (2.5k chats/day) with growth buffer for marketing pushes and seasonal spikes.
- **Alternatives considered**:
  - Match current baseline (2.5k): insufficient buffer for launch week surges.
  - Oversize for 20k chats: unnecessary complexity; would force premature sharding decisions.

## Decision 3: Prompt guideline consolidation

- **Decision**: Merge `提示词.md` and `破甲.md` guidance into nine enforceable rules covering scene structure, pacing, sensory detail, vocabulary variation, emotional continuity, and safety fallbacks.
- **Rationale**: Ensures SAFE and NSFW prompts share a consistent framework while respecting Gemini policy—organizing into rule blocks simplifies QA sign-off.
- **Alternatives considered**:
  - Reference docs verbatim in prompts: results in overly long system instructions and harder maintenance.
  - Create separate rule sets per character: too granular for MVP; would slow rollout and complicate moderation.
