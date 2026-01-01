# Character Localization System

本文档说明如何使用角色本地化系统，实现中英文双语支持。

## 功能概述

本地化系统提供以下功能：

1. **自动语言检测**：自动识别角色内容是中文还是英文
2. **AI 自动翻译**：使用 **Grok AI** 自动翻译角色所有字段（支持 NSFW 内容）
3. **批量处理**：支持批量翻译多个角色
4. **增量更新**：只翻译缺失的字段，避免重复翻译

### 为什么使用 Grok API？

- ✅ **支持 NSFW 内容**：Gemini 对成人内容有限制，Grok 可以自由翻译
- ✅ **高质量翻译**：保持原文的语气、风格和情感
- ✅ **与聊天系统一致**：使用相同的 AI 服务，配置统一

## 数据库结构

### Character 表新增字段

```sql
-- 英文版本字段
name_en              VARCHAR(255)   -- 英文角色名
description_en       TEXT           -- 英文描述
backstory_en         TEXT           -- 英文背景故事
opening_line_en      TEXT           -- 英文开场白
default_state_json_en TEXT          -- 英文状态 JSON
```

### 字段使用逻辑

- **中文角色**：`name`, `backstory` 等为中文，`name_en`, `backstory_en` 等为英文翻译
- **英文角色**：`name`, `backstory` 等为英文，中文字段可选
- **API 返回**：根据请求语言自动选择对应版本

## 使用步骤

### 1. 运行数据库迁移

```bash
cd backend
python migrations/016_add_multilingual_fields.py
```

### 2. 更新 models.py

在 `Character` 模型中添加新字段：

```python
class Character(Base):
    __tablename__ = "characters"

    # ... 现有字段 ...

    # Multilingual fields (English)
    name_en = Column(String(255), nullable=True)
    description_en = Column(Text, nullable=True)
    backstory_en = Column(Text, nullable=True)
    opening_line_en = Column(Text, nullable=True)
    default_state_json_en = Column(Text, nullable=True)
```

### 3. 翻译现有角色

#### 翻译所有角色

```bash
python scripts/translate_characters.py --all
```

#### 翻译特定角色

```bash
python scripts/translate_characters.py --id 1
```

#### 只翻译到英文

```bash
python scripts/translate_characters.py --all --target en
```

#### 预览模式（不保存）

```bash
python scripts/translate_characters.py --all --dry-run
```

#### 跳过已翻译的角色

```bash
python scripts/translate_characters.py --all --skip-existing
```

### 4. 创建角色时自动翻译

在角色创建 API 中集成自动翻译：

```python
from services.translation_service import get_translation_service

@router.post("/api/characters")
async def create_character(character_data: CharacterCreate):
    translation_service = get_translation_service()

    # 创建角色
    character = Character(**character_data.dict())
    db.add(character)
    db.commit()

    # 自动翻译
    source_lang = translation_service.detect_language(character.backstory)
    if source_lang == "zh":
        # 中文角色，翻译为英文
        translated = await translation_service.translate_character_data(
            {
                "name": character.name,
                "description": character.description,
                "backstory": character.backstory,
                "opening_line": character.opening_line,
                "default_state_json": character.default_state_json,
            },
            target_lang="en"
        )
        character.name_en = translated["name"]
        character.description_en = translated.get("description")
        character.backstory_en = translated["backstory"]
        character.opening_line_en = translated.get("opening_line")
        character.default_state_json_en = translated.get("default_state_json")
        db.commit()

    return character
```

### 5. API 返回多语言内容

根据请求头 `Accept-Language` 返回对应语言：

```python
@router.get("/api/characters/{id}")
async def get_character(
    id: int,
    request: Request
):
    character = db.query(Character).filter(Character.id == id).first()

    # 获取请求语言
    accept_lang = request.headers.get("Accept-Language", "en")
    preferred_lang = "zh" if "zh" in accept_lang else "en"

    # 根据语言返回对应版本
    if preferred_lang == "en" and character.backstory_en:
        return {
            "id": character.id,
            "name": character.name_en or character.name,
            "description": character.description_en or character.description,
            "backstory": character.backstory_en,
            "opening_line": character.opening_line_en or character.opening_line,
            "default_state_json": character.default_state_json_en or character.default_state_json,
            # ... 其他字段 ...
        }
    else:
        # 返回中文版本
        return {
            "id": character.id,
            "name": character.name,
            "description": character.description,
            "backstory": character.backstory,
            "opening_line": character.opening_line,
            "default_state_json": character.default_state_json,
            # ... 其他字段 ...
        }
```

## 状态 JSON 翻译

状态 JSON 的 key 也会自动翻译：

### 中文 → 英文

```json
{
  "衣着": "穿搭整洁得体"
}
```

↓ 翻译为 ↓

```json
{
  "Clothing": "Dressed neatly and appropriately"
}
```

### 量化状态翻译

```json
{
  "好感度": {
    "value": 4,
    "description": "初步建立好感"
  }
}
```

↓ 翻译为 ↓

```json
{
  "Favorability": {
    "value": 4,
    "description": "Initial rapport established"
  }
}
```

## 支持的状态 Key 映射

| 中文 | 英文 |
|------|------|
| 衣着 | Clothing |
| 仪态 | Demeanor |
| 情绪 | Mood |
| 好感度 | Favorability |
| 信任度 | Trust |
| 兴奋度 | Excitement |
| 疲惫度 | Fatigue |
| 环境 | Environment |
| 动作 | Action |
| 语气 | Tone |

### NSFW 状态映射

| 中文 | 英文 |
|------|------|
| 胸部 | Chest |
| 下体 | Lower_Body |
| 衣服 | Outfit |
| 姿势 | Posture |

## 最佳实践

### 1. 翻译时机

- **创建时翻译**：在角色创建时立即翻译，提供更好的用户体验
- **后台批量翻译**：使用脚本定期翻译新创建的角色
- **按需翻译**：在用户请求时才翻译（节省 API 调用）

### 2. 翻译质量

- AI 翻译保持原文的语气和风格
- 角色性格和情感会在翻译中保留
- 如需人工修正，可直接编辑翻译后的字段

### 3. 性能优化

- 使用 `--skip-existing` 避免重复翻译
- 批量翻译时使用异步处理
- 考虑使用后台任务队列（Celery）进行翻译

### 4. 错误处理

- 翻译失败时保留原文
- 记录翻译错误日志
- 提供手动重试机制

## 环境要求

- Python 3.9+
- `openai` 包（Grok 使用 OpenAI 兼容 API）
- 有效的 `GROK_API_KEY`

### 配置 GROK_API_KEY

在 `backend/.env` 文件中添加：

```bash
GROK_API_KEY=your-grok-api-key-here
```

获取 API Key：访问 [https://console.x.ai/](https://console.x.ai/)

## 常见问题

### Q: 翻译后原文会丢失吗？
A: 不会。原文保存在原字段中，翻译保存在 `_en` 字段中。

### Q: 可以翻译成其他语言吗？
A: 目前只支持中英互译。如需其他语言，可扩展 `translation_service.py`。

### Q: 翻译费用如何？
A: 使用 Grok API，费用取决于文本长度。建议查看 xAI 定价：[https://x.ai/api](https://x.ai/api)

### Q: 翻译质量如何保证？
A: Grok AI 翻译质量较高，但建议重要角色进行人工审核。

### Q: Grok 支持 NSFW 内容翻译吗？
A: 是的！这正是我们选择 Grok 的原因。Grok 不会审查或回避成人内容，会如实翻译所有内容。

### Q: 如果 GROK_API_KEY 未设置会怎样？
A: 翻译服务会返回原文，不会报错。建议设置 API Key 以启用自动翻译功能。

## 示例工作流

### 场景 1：新建中文角色

1. 用户创建中文角色（艾莉丝）
2. 系统检测到中文内容
3. 自动调用翻译服务翻译为英文
4. 保存中英双语版本
5. 根据用户语言偏好返回对应版本

### 场景 2：批量翻译历史角色

```bash
# 1. 运行迁移
python migrations/016_add_multilingual_fields.py

# 2. 翻译所有角色（预览）
python scripts/translate_characters.py --all --dry-run

# 3. 确认无误后执行
python scripts/translate_characters.py --all

# 4. 检查翻译结果
sqlite3 roleplay_chat.db "SELECT name, name_en FROM characters LIMIT 5;"
```

### 场景 3：只翻译新角色

```bash
# 跳过已有翻译的角色
python scripts/translate_characters.py --all --skip-existing
```

## 技术细节

### 语言检测算法

```python
def detect_language(text: str) -> Literal["zh", "en"]:
    chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
    total_chars = len(text)

    # 中文字符超过 30% 则判定为中文
    if total_chars > 0 and chinese_chars / total_chars > 0.3:
        return "zh"
    return "en"
```

### 翻译提示词模板

```python
# 中译英
prompt = f"""Please translate the following Chinese content into natural, fluent English.
Maintain the original tone, style, and emotion.
Content type: {context}

Chinese original:
{text}

English translation:"""

# 英译中
prompt = f"""请将以下英文内容翻译成自然流畅的中文。保持原文的语气、风格和情感。
内容类型：{context}

英文原文：
{text}

中文翻译："""
```

## 未来扩展

- [ ] 支持更多语言（日语、韩语等）
- [ ] 翻译缓存机制
- [ ] 人工审核工作流
- [ ] 翻译版本管理
- [ ] 翻译质量评分
- [ ] 用户自定义翻译

## 相关文件

- `services/translation_service.py` - 翻译服务核心逻辑
- `migrations/016_add_multilingual_fields.py` - 数据库迁移
- `scripts/translate_characters.py` - 批量翻译脚本
- `models.py` - 数据库模型定义
