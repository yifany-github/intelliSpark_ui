# Multi-Role Story Chat Engine — Specification

> Purpose: blueprint for extending the existing single-character chat into a multi-role, story-driven engine that fits the current Vite + FastAPI stack. Focus on durable story state, branchable scenes, and fast authoring via YAML story packs.

---

## 1) Goals & Non-Goals

**Goals**
- Deliver a party-style narrative chat where the user controls one role and the remaining cast is AI-driven.
- Represent the story as scenes, choices, and flags stored in a shared world state so branches stay coherent.
- Separate orchestration concerns: **Director** (plan), **Characters** (act), **Arbiter** (rules), **Narrator** (describe).
- Make creating new stories low-friction with declarative YAML packs and hot reload support.
- Enforce PG safety defaults and keep prompts mod-friendly.

**Non-Goals**
- Real-time audio/3D rendering.
- Hard-binding to a single LLM vendor; keep adapters so Gemini/OpenAI/etc. can be swapped.

---

## 2) Architecture & Repo Layout

**Frontend (React 18 + Vite)**
- `client/src/pages/story/` · new multi-role experience entry point.
- `client/src/services/storySession.ts` · API client for session lifecycle.
- `client/src/components/story/` · UI pieces (role selector, scene summary, action chips).

**Backend (FastAPI + SQLAlchemy)**
- `backend/story_engine/` · pure orchestration layer (state machine, rule evaluation).
- `backend/services/story_service.py` · session lifecycle and LLM coordination.
- `backend/routes/story_routes.py` · REST endpoints for discovery, turns, and session polling.
- `backend/models.py` · SQLAlchemy models expanded with `StorySession` + `StoryLog`.

**Shared Resources**
- Story packs live under `backend/story_engine/stories/{story_id}/`.
- Prompt templates in `backend/story_engine/prompts/`.
- Tests under `backend/tests/story/` and `client/src/pages/story/__tests__/`.

---

## 3) Story Data Model (Pydantic)

```python
from pydantic import BaseModel
from typing import Dict, List, Literal, Optional

RoleId = str
SceneId = str

class Effect(BaseModel):
    set_flag: Optional[Dict[str, bool]] = None
    set_var: Optional[Dict[str, str]] = None
    give_item: Optional[Dict[str, str]] = None  # {"to": role, "item": name}
    remove_item: Optional[Dict[str, str]] = None
    set_location: Optional[str] = None
    time_advance: Optional[str] = None

class Choice(BaseModel):
    id: str
    prompt: str
    when: Optional[str] = None  # DSL evaluated by rules engine
    effects: List[Effect] = []
    goto: Optional[SceneId] = None

class Scene(BaseModel):
    id: SceneId
    title: str
    desc: str
    on_enter: List[Effect] = []
    choices: List[Choice]

class RoleSpec(BaseModel):
    id: RoleId
    name: str
    traits: List[str] = []
    inventory: List[str] = []
    prompt_tags: List[str] = []

class StoryPack(BaseModel):
    id: str
    title: str
    start_scene: SceneId
    roles: List[RoleSpec]
    variables: Dict[str, str] = {}
    flags: Dict[str, bool] = {}
    scenes: List[Scene]
```

World state is stored as JSON (SQLAlchemy JSON column) and mirrors `StoryPack`, adding inventories, stats, and memory buffers per role.

---

## 4) Story Packs (Authoring Format)

```
backend/story_engine/stories/doraemon-underworld/
  story.yaml   # scenes + choices
  roles.yaml   # playable + AI cast
  rules.yaml   # checks, cooldowns, content rating (optional)
  README.md    # author guidance
```

Schemas mirror the examples already drafted; validate with Pydantic on load. Packs are auto-discovered at startup and reloaded on file change (watchdog in dev).

Example `story.yaml` excerpt:
```yaml
id: doraemon-underworld
title: 新·大魔境（演示）
start_scene: S1_opening
variables:
  time: Day1-Morning
  location: 学校后空地
scenes:
  - id: S1_opening
    title: 学校后空地
    desc: 放学后大家在空地集合，天空微阴。
    choices:
      - id: talk_rumor
        prompt: 与伙伴讨论今天的探险传闻
        effects:
          - set_flag: { met_miya: true }
        goto: S2_miya
```

---

## 5) Session Persistence

Extend `backend/models.py`:
```python
class StorySession(Base):
    __tablename__ = "story_sessions"
    id = Column(String, primary_key=True)
    story_id = Column(String, index=True)
    state = Column(JSON, nullable=False)  # serialized WorldState
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class StoryLog(Base):
    __tablename__ = "story_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id = Column(String, ForeignKey("story_sessions.id", ondelete="CASCADE"))
    kind = Column(String)  # USER_INPUT | AI_ACTION | DIRECTOR | ARBITER | NARRATION
    payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
```

SQLite (dev) and Supabase Postgres (prod) both support the JSON column. Logs store deterministic seeds and patches for replay.

---

## 6) Engine Flow (Python Service)

```python
def run_turn(session_id: str, user_role: RoleId, user_text: str) -> TurnResult:
    state = store.load(session_id)
    pack = registry.get(state.story_id)

    user_action = extractor.to_dsl(user_text, user_role, state)
    ai_actions = proposer.gather_other_roles(state, user_role)
    merged = director.merge([user_action, *ai_actions], state)

    adjudication = arbiter.judge(merged, state, pack.rules)
    new_state = patcher.apply(state, adjudication.patch)

    narration = narrator.describe(adjudication.results, new_state, pack)
    next_scene = transitions.pick_next_scene(new_state, pack)
    if next_scene:
        new_state["scene_id"] = next_scene

    store.save(session_id, new_state)
    logger.log_all(session_id, user_action, ai_actions, adjudication, narration)

    return TurnResult(narration=narration, state=new_state, log=adjudication.results)
```

Each component is hidden behind an interface so we can swap Gemini/OpenAI or add caching. Random checks use seeded RNG for replay.

---

## 7) Prompt Orchestration

**Character Agents**: build from persona traits + scene context.
```
System:
你是“{ROLE_NAME}”。依据 traits/prompt_tags 扮演角色，生成至多2个行动DSL候选推动当前场景。
约束：不得编造物品；遵守规则冷却；保持PG语气。
输入: WORLD_STATE, INVENTORY。
输出: JSON数组，仅包含合法行动DSL。
```

**Director**: merges user action with AI proposals, resolves conflicts, prioritizes plot momentum and safety.

**Arbiter**: enforces rules using DSL evaluator (`flag()`, `has_item()`, etc.), rolls checks through `roll_check`, returns JSON patch + results log.

**Narrator**: converts results into 120–180字的叙述，展示新线索或可选行动。

Prompt templates live in `backend/story_engine/prompts/` and use the current LLM service (`Gemini` by default via `backend/services/ai_service.py`).

---

## 8) Rules Engine & Tools

- Expression evaluator uses `asteval` or a custom safe parser to support helpers: `flag(name)`, `has(role, item)`, `location_is(name)`, `var(key)`.
- Checks table loaded from `rules.yaml`, e.g.:
```yaml
checks:
  perception: { dc: 50 }
  luck: { dc: 55 }
```
- Tools interface (Python):
```python
class Tools(Protocol):
    def roll_check(self, *, kind: str, dc: int, bonus: int = 0) -> CheckResult: ...
    def apply_effects(self, effects: List[Effect], state: WorldState) -> JsonPatch: ...
    def use_item(self, actor: RoleId, item: str) -> ItemResult: ...
```
- Safety guardrails: degrade actions violating rating (e.g., reject violence spikes when minorsStrictMode=true).

---

## 9) API Contract (FastAPI)

```
GET    /api/stories                 -> list available story packs
POST   /api/stories/{id}/sessions   -> { user_role } -> { session_id, state }
POST   /api/story-sessions/{id}/turn -> { user_role, text } -> { narration, state, actions_log }
GET    /api/story-sessions/{id}     -> current state + metadata
POST   /api/story-packs/validate    -> upload YAML -> { ok, errors[] }
```

Responses reuse existing response models (`schemas.py`) with new Pydantic DTOs. SSE/WebSocket streaming can be added later but initial implementation may keep REST with optimistic updates.

---

## 10) Frontend Experience

- Role Selection Modal: fetch story + roles, let user choose playable character before session start.
- Scene HUD: display location, time, current objectives, visited scene map.
- Chat Pane: reuse existing chat surface, annotate speaker bubbles with role badges; include narrator summaries between turns.
- Action Suggestions: chips pulled from current scene choices and AI proposals to help the user respond quickly.
- Branch Timeline (optional): breadcrumb of visited scenes for context.

React Query caches session state; optimistic updates wrap `POST /turn`. For long responses, show streaming placeholder and finalize once narration arrives.

---

## 11) Safety & Compliance

- Reuse current moderation pipeline; add story-level rating metadata (PG default) and enforce in prompts.
- If LLM proposes off-limits content, Arbiter downgrades the action and Narrator redirects (“故事适合探索线索，请尝试查找入口。”).
- IP guidance: Doraemon pack is internal demo only. Document replacement requirements in `README.md` before shipping.

---

## 12) Telemetry & Ops

- Extend existing logging to capture per-turn durations (extractor, proposer, arbiter, narrator).
- Store RNG seeds and JSON patches in `StoryLog` for deterministic replay.
- Emit counters to stdout/ELK: tokens/turn, branch frequencies, error rates.
- On story pack hot reload, clear in-memory cache and broadcast invalidation to running workers (if any).

---

## 13) Testing Strategy

- **Schema Validation**: load every YAML pack on CI and assert conversion to `StoryPack`.
- **Happy Path Integration**: simulate a three-scene progression via FastAPI test client; assert state transitions and narration include expected beats.
- **Branch Coverage**: unit test condition evaluator with positive/negative cases.
- **Safety Regression**: prompt Arbiter with disallowed actions; expect rejection.
- **Frontend**: React Testing Library snapshot for role selector and action bar; MSW mocks backend.

---

## 14) Implementation Checklist

- [ ] Scaffold Pydantic models and YAML loader with validation errors surfaced to authors.
- [ ] Create `StorySession` persistence and migration (Alembic).
- [ ] Implement engine services (extractor, proposer, director, arbiter, narrator) with pluggable LLM client.
- [ ] Add FastAPI routes + OpenAPI docs; secure with existing auth middleware.
- [ ] Build React story page, role selector, and enhanced chat view.
- [ ] Author Doraemon demo pack and verify end-to-end flow.
- [ ] Write backend and frontend tests outlined above.
- [ ] Update `README.md` / `AGENTS.md` with story authoring and setup notes.
