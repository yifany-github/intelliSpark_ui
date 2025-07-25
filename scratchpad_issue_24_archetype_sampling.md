# Issue #24: Create archetype-based few-shot sampling script with JSON file output

**GitHub Issue:** https://github.com/YongBoYu1/intelliSpark_ui/issues/24

## Analysis

### Current State
- **Character file**: `backend/prompts/characters/艾莉丝.py` 
  - Has `PERSONA_PROMPT` with character description
  - Has `FEW_SHOT_EXAMPLES` as string format (not JSON)
- **Dataset**: `global_dataset.csv` with columns: `book_name,pair_id,user,assistant,archetype`
  - Contains adult/NSFW content with archetypes like "娇羞敏感者" (shy/sensitive)
- **Prompt Loading**: `gemini_service.py` lines 44-48 directly imports and combines prompts

### Requirements Summary
1. **Add archetype configuration** to character files with weighted sampling
2. **Create sampling script** that reads CSV and generates JSON based on weights  
3. **Convert FEW_SHOT_EXAMPLES** to JSON format in character files
4. **Update prompt service** to handle JSON format (optional)
5. **Manual workflow** for integrating sampled examples

### Target Archetype Weights (from issue)
- "娇羞敏感者": 0.7 (Primary - shy/sensitive)
- "温柔体贴者": 0.2 (Secondary - gentle/caring)
- "活泼开朗者": 0.1 (Minor - lively/cheerful)

## Implementation Plan

### 1. Character File Updates (`backend/prompts/characters/艾莉丝.py`)
- Add `ARCHETYPE_WEIGHTS` dictionary at top
- Convert `FEW_SHOT_EXAMPLES` to JSON format
- Keep `PERSONA_PROMPT` unchanged

### 2. Sampling Script (`backend/scripts/sample_few_shots.py`)
- Load CSV data with pandas
- Import character config to get archetype weights
- Sample dialogues proportionally by archetype weights
- Output JSON file with sampled examples
- CLI interface with argparse

### 3. Prompt Service Updates (`backend/gemini_service.py`)
- Update prompt loading logic to handle JSON format
- Convert JSON examples to string format for AI service
- Maintain backward compatibility

### 4. Directory Structure
```
backend/
├── scripts/
│   ├── __init__.py
│   └── sample_few_shots.py
├── prompts/
│   └── characters/
│       ├── 艾莉丝.py (updated)
│       └── sampled_few_shots_艾莉丝.json (generated)
```

### 5. Usage Workflow
```bash
cd backend
python scripts/sample_few_shots.py --character 艾莉丝 --samples 150
# Manual: Copy JSON content to FEW_SHOT_EXAMPLES in character file
```

## Key Considerations
- Dataset contains adult content - need appropriate handling
- Need to ensure sufficient examples exist for each archetype
- Maintain backward compatibility with existing prompt loading
- Weighted sampling should respect archetype distribution requirements
- JSON format needs proper UTF-8 encoding for Chinese characters

## Success Criteria
- [x] Script generates JSON file with 150 examples
- [x] Examples distributed according to weights (70%/20%/10%)
- [x] Character file updated with working JSON format
- [x] No disruption to existing prompt loading
- [x] Proper UTF-8 handling for Chinese text

## Files to Create/Modify
- **Create**: `backend/scripts/__init__.py`
- **Create**: `backend/scripts/sample_few_shots.py`
- **Modify**: `backend/prompts/characters/艾莉丝.py`
- **Modify**: `backend/gemini_service.py`
- **Generate**: `backend/prompts/characters/sampled_few_shots_艾莉丝.json`