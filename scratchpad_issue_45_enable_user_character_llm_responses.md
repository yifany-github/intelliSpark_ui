# Issue #45: Enable user-created characters to generate LLM responses

**GitHub Issue:** https://github.com/yifany-github/intelliSpark_ui/issues/45

## Problem Summary
User-created characters (like "TestBot") currently fall back to generic responses because the LLM system only supports hard-coded character '艾莉丝'. Users can create rich characters through the creation form, but these characters don't actually influence the AI responses.

**Current behavior**: TestBot → Generic fallback response  
**Expected behavior**: TestBot → Character-specific response using TestBot's personality

## Current State Analysis

### Broken Implementation
**File:** `backend/gemini_service.py` **Lines:** 68-78 and 247-256
- Only hardcoded support for character "艾莉丝"
- User-created characters fall back to generic `_simulate_response()` method
- Same issue affects both main chat responses and opening line generation

### Character Data Available
**File:** `backend/models.py` **Lines:** 31-50 (Character model)
Available attributes for user-created characters:
- `name` - Character identity
- `description` - Short personality description
- `backstory` - Detailed background and context
- `voice_style` - How character speaks
- `traits` - List of personality traits
- `personality_traits` - Dict of trait percentages
- `category`, `gender`, `age`, `occupation` - Additional context

### Working Hardcoded Example
**File:** `backend/prompts/characters/艾莉丝.py`
Shows the working pattern:
- `PERSONA_PROMPT` - Detailed character description for AI context
- `FEW_SHOT_EXAMPLES` - Conversation examples in proper Gemini format

## Implementation Plan

### Phase 1: Create Dynamic Prompt Generation Method
**Target:** New method `_get_character_prompt()` in `GeminiService` class

```python
def _get_character_prompt(self, character: Character) -> dict:
    # Keep existing hardcoded characters unchanged
    if character.name == "艾莉丝":
        from prompts.characters.艾莉丝 import PERSONA_PROMPT, FEW_SHOT_EXAMPLES
        return {"persona_prompt": PERSONA_PROMPT, "few_shot_contents": FEW_SHOT_EXAMPLES}
    
    # NEW: Generate dynamic prompt for user-created characters
    else:
        persona_prompt = f"""
## Character: {character.name}

### Description
{character.description}

### Background
{character.backstory}

### Voice Style
{character.voice_style}

### Personality Traits
{', '.join(character.traits) if character.traits else 'Friendly, helpful'}

### Instructions
You are {character.name}. Respond using the personality and background described above.
Keep responses consistent with this character's nature, voice style, and traits.
Always stay in character and reflect {character.name}'s unique personality.
"""
        return {
            "persona_prompt": persona_prompt,
            "few_shot_contents": []  # Start with empty, can enhance later
        }
```

### Phase 2: Update generate_response Method
**Target:** `backend/gemini_service.py` lines 64-78
Replace hardcoded character check with call to `_get_character_prompt()`:

```python
# OLD CODE (lines 68-78):
if character and character.name == "艾莉丝":
    from prompts.characters.艾莉丝 import PERSONA_PROMPT, FEW_SHOT_EXAMPLES
    # ... hardcoded logic

# NEW CODE:
character_prompt = {}
if character:
    character_prompt = self._get_character_prompt(character)
```

### Phase 3: Update generate_opening_line Method
**Target:** `backend/gemini_service.py` lines 244-256
Apply same pattern for opening line generation:

```python
# OLD CODE (lines 247-256):
if character and character.name == "艾莉丝":
    from prompts.characters.艾莉丝 import PERSONA_PROMPT, FEW_SHOT_EXAMPLES
    # ... hardcoded logic

# NEW CODE:
character_prompt = {}
if character:
    character_prompt = self._get_character_prompt(character)
```

### Phase 4: Update Fallback Response Generator
**Target:** `backend/gemini_service.py` lines 222-227
Enhance the generic fallback response to use character attributes:

```python
# Enhanced fallback for user-created characters
if character and character.name not in response_templates:
    character_responses = [
        f"*responds as {character.name}* {character.description}. How can I help you?",
        f"*maintains {character.name}'s personality* {character.backstory[:100]}... What would you like to know?",
        f"*stays true to {character.name}'s nature* I'm here to chat with you in my unique way!",
    ]
    response_templates[character.name] = character_responses
```

## Implementation Steps

### Step 1: Add _get_character_prompt Method
- Add new method to GeminiService class
- Implement logic for hardcoded characters (unchanged)  
- Implement dynamic prompt generation for user-created characters
- Use character model attributes to build persona prompt

### Step 2: Update generate_response Method
- Replace hardcoded character check with _get_character_prompt call
- Ensure existing '艾莉丝' functionality remains unchanged
- Test that cache creation works with dynamic prompts

### Step 3: Update generate_opening_line Method  
- Apply same _get_character_prompt pattern
- Ensure opening lines reflect character personality
- Test opening line generation for user-created characters

### Step 4: Enhance Fallback Responses
- Update _simulate_response to use character attributes
- Improve generic responses for when AI is unavailable
- Maintain backward compatibility

## Testing Strategy

### Manual Testing Checklist
- [ ] Create test character "FriendlyBot" with description "A warm, supportive assistant"
- [ ] Start chat with FriendlyBot → Verify responses are warm/supportive (not generic)
- [ ] Test opening line generation for user-created character
- [ ] Verify '艾莉丝' still works normally (no regression)
- [ ] Test fallback responses when AI is unavailable
- [ ] Performance test: Response generation time should be similar to hardcoded characters

### Automated Testing
- [ ] Run full test suite: `npm test`
- [ ] TypeScript type checking: `npm run check`
- [ ] Backend tests: `cd backend && python -m pytest`
- [ ] Build verification: `npm run build`

## Success Criteria
- [x] User creates "TestBot" → TestBot gives character-specific responses (not generic)
- [x] Responses reflect TestBot's personality from creation form data
- [x] Existing '艾莉丝' functionality remains unchanged  
- [x] No performance regression (use existing cache system)
- [x] Works with current `POST /api/chats/{id}/generate` endpoint
- [x] Opening lines also reflect character personality

## Technical Requirements
- Keep existing '艾莉丝' implementation unchanged (backward compatibility)
- Use same prompt format as '艾莉丝' for consistency
- Leverage existing cache system (`_create_or_get_cache`)
- No database schema changes needed
- No frontend changes needed
- Follow SpicyChat standard (simple but effective)

## Files to Modify
1. **Primary:** `backend/gemini_service.py`
   - Add `_get_character_prompt()` method
   - Update `generate_response()` method (lines 64-78)
   - Update `generate_opening_line()` method (lines 244-256)
   - Enhance `_simulate_response()` method (lines 222-227)

## Commit Strategy
1. **Add dynamic character prompt generation method**
2. **Update generate_response to support user-created characters**  
3. **Update opening line generation for user-created characters**
4. **Enhance fallback responses with character attributes**
5. **Test and fix any issues discovered**

## Potential Risks & Mitigation
- **Risk**: Regression in '艾莉丝' functionality
  - **Mitigation**: Keep hardcoded path unchanged, test thoroughly
- **Risk**: Performance impact from dynamic prompt generation
  - **Mitigation**: Use existing cache system, minimal string operations
- **Risk**: Empty or malformed character data
  - **Mitigation**: Add fallbacks and validation in prompt generation

## Dependencies Status
- ✅ **Issue #41**: Character creation API is working (merged)
- ✅ **Issue #25**: Gemini API migration completed (merged)
- ✅ **Character Model**: All necessary attributes available in database
- ✅ **Authentication**: JWT system works for character access

---
*Created: 2025-07-31*
*Issue Priority: High - Core functionality for user engagement*
*Estimated effort: 2-3 hours (focused implementation)*