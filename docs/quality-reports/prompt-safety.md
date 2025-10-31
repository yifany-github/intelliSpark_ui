# Prompt Safety Regression Log

**Baseline Window**: 2025-10-14 → 2025-10-21  
**Environment**: Gemini 2.0 flash (staging)

| Scenario | Requests | Refusals | Refusal Rate |
|----------|----------|----------|--------------|
| SAFE archetype script | 40 | 1 | 2.5% |
| NSFW archetype script | 40 | 3 | 7.5% |

- Target after prompt refresh: refusal率 <= baseline +5pp (SAFE ≤7.5%，NSFW ≤12.5%).
- Record deviations and attach conversation IDs for follow-up.
