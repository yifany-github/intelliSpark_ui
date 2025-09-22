# Issue 200 · Multi-Role Story Chat Framework

## Summary
Build a reusable storytelling framework that enables interactive, branching chats featuring multiple AI-controlled characters and one user-controlled role. The framework should load a story blueprint (setting, phases, roles, objectives), coordinate persona prompts per character, and manage state transitions as the user makes choices.

## Goals
- Let scenario builders define story arcs for well-known franchises (e.g., Doraemon: Nobita's New Great Adventure into the Underworld) using structured metadata.
- Allow the user to select a playable character while the system drives the remaining cast with AI personas.
- Persist story progress, track plot milestones, and adjust AI prompts based on user decisions.
- Expose APIs/hooks for the UI to render current scene info, available actions, and dialogue history.

## Non-Goals
- Real-time multimedia rendering or voice acting.
- Automatic content moderation (assume existing filters handle this).
- Long-term save/load slots beyond a single session.

## Milestones & Checklist
- [x] Define story blueprint schema (roles, scenes, triggers, win/lose conditions).
- [ ] Extend backend persona engine to spawn multiple AI agents per session.
- [ ] Implement story state manager with phase transitions and branching logic.
- [x] Create API endpoints for story discovery, session start, turn submission, and progression updates.
- [x] Update front-end hooks/components to surface multi-role sessions (role selection, timeline, prompts).
- [ ] Add integration tests covering a happy-path story flow and divergent branch.

## Technical Notes
- Reuse existing single-role chat pipeline where possible; encapsulate new orchestration in a service (e.g., `backend/story_engine/multi_role_manager.py`).
- Consider storing story metadata in JSON/YAML under `backend/story_engine/stories/` with validation via Pydantic models.
- Each AI role might maintain its own context window; evaluate using shared global memory plus character-specific memory slices.
- For branching, define triggers (user action, timer, condition) and resulting scene transitions.

## Open Questions
1. How should we represent action choices—free-form text interpreted by LLM or curated options per scene?
2. Do we need deterministic seeding to replay story paths for QA purposes?
3. What persistence layer should track session state (SQLite vs. Supabase)?

## References
- Existing single-persona chat implementation (`client/src/services/chat` + `backend/story_engine/`).
- Doraemon story synopsis: https://en.wikipedia.org/wiki/Doraemon:_Nobita%27s_New_Great_Adventure_into_the_Underworld (use for narrative structure inspiration).
