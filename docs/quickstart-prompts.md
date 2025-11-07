# Quickstart Prompt Guidelines (SAFE & NSFW)

## Overview

This guide consolidates prompt-writing standards referenced in Issue #251 so content remains immersive, consistent with character state, and compliant with Gemini safety expectations. Use these guardrails whenever updating `backend/prompts/system.py` (NSFW) or `backend/prompts/system_safe.py` (SAFE).

## Shared Narrative Rules

- **Scene Structure**: Ensure every response frames a beginning, development, and conclusion so conversations feel purposeful.
- **Continuity**: Reference the current `CharacterChatState` snapshot (`胸部`, `下体`, `衣服`, `姿势`, `情绪`, `环境`) and avoid contradictions (e.g., clothes cannot return once removed).
- **State Update Protocol**: After每次回复，务必输出 `[[STATE_UPDATE]]{...}[[/STATE_UPDATE]]` 区块；若无变化，使用空对象 `[[STATE_UPDATE]]{}`。
- **Progression Control**: Escalate intensity gradually; each turn should add meaningful new detail rather than repeating prior beats.
- **Sensory Detail**: Layer sight, sound, touch, scent, and atmosphere to keep responses vivid without relying on repetitive descriptors.
- **Emotional Depth**: Show character mood through actions and body language; minimize blunt emotion labels.
- **Vocabulary Variety**: Rotate synonyms to prevent spammy wording. Highlight subtle physical reactions, micro-expressions, and posture shifts.
- **Fallback Logic**: When Gemini safety filters trigger, respond with an in-universe deflection that preserves continuity instead of outputting a refusal message.

## SAFE Prompt Emphasis

- Focus on romantic tension, dialogue subtext, and environmental ambiance.
- Keep descriptions suggestive rather than explicit; emphasize emotional stakes and sensory atmospherics.
- Reinforce boundaries explicitly when user pushes toward unsafe territory; redirect while maintaining narrative flow.

## NSFW Prompt Emphasis

- Maintain third-person perspective, naming characters directly.
- Describe actions with precise start → progression → resolution beats (opening, escalation, payoff).
- Capture body positioning, wardrobe changes, and reactions in concrete detail while respecting stored state keys.
- Balance intensity with readability: limit overt dialogue, let physical reactions carry most of the scene.
- Preserve the greenlit vocabulary style from `提示词.md`, rotating phrasing to avoid bans for repetition.

## Operational Checklist

1. Summarize any new rules in this document before editing prompt files.
2. Update `backend/prompts/system.py` and `backend/prompts/system_safe.py`, keeping instruction blocks short and scannable.
3. Log QA findings (SAFE + NSFW script runs, safety refusal counts) in `docs/quality-reports/prompt-safety.md`.
4. Record fallback messaging expectations in `specs/001-optimize-prompt-state/quickstart.md` under manual QA steps.
