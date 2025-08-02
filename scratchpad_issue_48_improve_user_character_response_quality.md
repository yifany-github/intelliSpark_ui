# Issue #48: Improve User-Created Character Response Quality and Context Handling

**GitHub Issue:** https://github.com/yifany-github/intelliSpark_ui/issues/48

## Problem Analysis (Based on Testing)

### ✅ Current State Confirmed
After testing both user-created and hardcoded characters, the quality disparity is clear:

**TestBot (User-Created) Responses:**
- Opening line: "Hello! I'm TestBot. A compassionate individual who finds joy in connecting with others and offering support.... How can I help you today?"
- Response: "*maintains TestBot's personality* Based on my background: A compassionate individual who finds joy in connecting with others and offering support.... What would you like to know?"

**艾莉丝 (Hardcoded) Responses:**
- Opening line: "（轻轻咬着下唇，琥珀色眼眸带着一丝羞涩，又带着一丝期待）嗯… 亲爱的，欢迎登机，有什么我可以为你服务的吗？ 是… 是你想先喝点什么，还是… （声音越来越小，脸颊也泛起淡淡的红晕）还是… 有别的什么特别的… 要求呢？"
- Response: Rich, immersive roleplay with detailed emotional expressions and consistent character personality

### 🔍 Root Cause Analysis Confirmed

**艾莉丝 Advantages:**
- **File Size:** 107 lines of persona prompt (11.4KB)
- **Few-Shot Examples:** 130 conversation examples (111KB JSON file)
- **Language:** Consistent Chinese language throughout
- **Quality:** Rich emotional descriptions, immersive roleplay elements

**User-Created Character Limitations:**
- **Prompt Template:** Basic 20-line English template with minimal personality context
- **Few-Shot Examples:** Empty array `[]` (line 78 in gemini_service.py)
- **Language Inconsistency:** System prompt in Chinese, dynamic template in English
- **Generic Fallback:** Falls back to `_simulate_response()` with template responses

## Implementation Strategy

### Phase 1: Enhanced Character Prompt Template (High Impact)
**Target:** `backend/prompts/character_templates.py`

**Current Template Issues:**
- English language conflicts with Chinese system prompt
- Generic instructions lacking personality depth
- Missing immersive roleplay guidance

**Enhanced Template:**
```python
DYNAMIC_CHARACTER_TEMPLATE = """## 角色设定：{name}

### 核心身份
{description}

### 背景故事  
{backstory}

### 说话风格
{voice_style}

{traits_section}{character_details_section}

### 行为指南
你是{name}，严格按照上述设定进行对话。保持角色一致性，体现独特个性。

回应要求：
- 使用角色特有的语气和表达方式
- 结合角色的知识背景和经历
- 保持对话的自然流畅
- 适当使用动作描述和环境描写来增强沉浸感
- 长度适中，通常在100-300字之间
- 根据对话内容自然地推进情节发展
- 保持适当的互动节奏，既不过于冷淡也不过于热情

你必须完全沉浸在{name}的角色中，用{name}的思维方式思考，用{name}的语言风格说话。"""
```

### Phase 2: Generic Few-Shot Examples System 
**Target:** Create `backend/prompts/generic_few_shots.json`

**Personality Archetype Detection:**
Based on character traits and description, auto-detect personality type:
- 友善型 (Friendly): warm, supportive responses
- 神秘型 (Mysterious): enigmatic, intriguing responses  
- 活泼型 (Lively): energetic, enthusiastic responses

**Generic Conversation Examples:**
```json
{
  "personality_archetypes": {
    "友善型": [
      {"role": "user", "content": "你好"},
      {"role": "assistant", "content": "*温暖地微笑* 你好！很高兴见到你，有什么我可以帮助你的吗？"}
    ],
    "神秘型": [
      {"role": "user", "content": "你好"},
      {"role": "assistant", "content": "*从阴影中缓缓现身* 又是一个有趣的访客...你是被什么吸引到这里来的？"}
    ],
    "活泼型": [
      {"role": "user", "content": "你好"},
      {"role": "assistant", "content": "*兴奋地跳起来* 哇！新朋友！你好你好！今天一定会是超级棒的一天，因为遇到了你！"}
    ]
  }
}
```

### Phase 3: Character Prompt Enhancer Service
**Target:** Create `backend/utils/character_prompt_enhancer.py`

**Core Functions:**
- `analyze_personality_archetype()` - Keyword-based archetype detection
- `generate_few_shot_examples()` - Select appropriate conversation examples
- `enhance_dynamic_prompt()` - Generate enhanced prompts with few-shot examples

### Phase 4: Integration into Gemini Service
**Target:** `backend/gemini_service.py` lines 47-79

**Current Code (Lines 67-78):**
```python
persona_prompt = DYNAMIC_CHARACTER_TEMPLATE.format(...)
return {
    "persona_prompt": persona_prompt,
    "few_shot_contents": []  # Start with empty, can enhance later
}
```

**Enhanced Code:**
```python
# Generate enhanced prompt for user-created characters
elif character:
    enhancer = CharacterPromptEnhancer()
    return enhancer.enhance_dynamic_prompt(character)
```

## Technical Implementation Plan

### Step 1: Enhanced Template Creation ✅
- [x] Analyze current template issues
- [ ] Create Chinese-consistent enhanced template
- [ ] Add immersive roleplay instructions
- [ ] Test with sample character data

### Step 2: Few-Shot Examples System
- [ ] Create generic conversation examples JSON
- [ ] Implement personality archetype detection
- [ ] Create character prompt enhancer utility
- [ ] Test archetype detection accuracy

### Step 3: Service Integration  
- [ ] Update gemini_service.py to use enhancer
- [ ] Ensure backward compatibility with 艾莉丝
- [ ] Add proper logging and error handling
- [ ] Performance testing with cache system

### Step 4: Testing & Validation
- [ ] Create test characters with different archetypes
- [ ] Browser automation testing for response quality
- [ ] Compare conversation quality before/after
- [ ] Performance benchmarking

## Expected Quality Improvements

### Response Quality Metrics
- **Current User Characters:** Generic fallback responses, inconsistent language
- **Target User Characters:** 80%+ quality parity with 艾莉丝
- **Language Consistency:** All Chinese responses with proper roleplay elements
- **Context Retention:** Improved personality consistency across conversation

### Success Criteria
- [ ] User-created character opening lines have personality depth
- [ ] Conversation responses include immersive roleplay elements  
- [ ] Chinese language consistency throughout
- [ ] No regression in 艾莉丝 functionality
- [ ] Response generation time remains under 3 seconds

## Files to Modify

### Core Implementation
1. **`backend/prompts/character_templates.py`** - Enhanced Chinese template
2. **`backend/prompts/generic_few_shots.json`** - New few-shot examples system
3. **`backend/utils/character_prompt_enhancer.py`** - New enhancer service
4. **`backend/gemini_service.py`** - Integration updates

### Testing Infrastructure  
5. **`backend/tests/test_character_prompt_enhancer.py`** - Unit tests
6. **Browser automation tests** - End-to-end quality verification

## Risk Mitigation

### Backward Compatibility
- ✅ 艾莉丝 hardcoded path unchanged (lines 39-44)
- ✅ Fallback system maintains current behavior
- ✅ Cache system compatible with enhanced prompts

### Performance Considerations
- Few-shot examples: 6-10 examples vs 艾莉丝's 130 (manageable size)
- Archetype detection: Simple keyword matching (fast)
- Cache system: Existing infrastructure handles enhanced prompts

### Quality Assurance
- A/B testing framework for response comparison
- Manual testing with diverse character types
- Gradual rollout with monitoring

---

*Created: 2025-08-02*  
*Issue Priority: High - Core functionality for user engagement*  
*Estimated Effort: 8-12 hours implementation + testing*  
*Expected Impact: 40-60% improvement in user-created character engagement*