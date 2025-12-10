# 翻译系统快速开始

本指南帮助你快速启用角色本地化翻译功能。

## 🚀 5 分钟快速开始

### 1. 确认环境配置

检查 `backend/.env` 文件中是否有 GROK_API_KEY：

```bash
# 必须配置
GROK_API_KEY=your-grok-api-key-here
```

如果没有，请添加后重启后端服务。

### 2. 运行数据库迁移

```bash
cd backend
python migrations/016_add_multilingual_fields.py
```

输出示例：
```
Starting migration: Add multilingual fields to characters table
Adding name_en column...
Adding description_en column...
Adding backstory_en column...
Adding opening_line_en column...
Adding default_state_json_en column...
✓ Migration completed successfully
```

### 3. 测试翻译（单个角色，预览模式）

```bash
python scripts/translate_characters.py --id 1 --dry-run
```

输出示例：
```
🌐 Character Translation Service
============================================================
Found 1 character(s) to process

============================================================
Translating character: 艾莉丝 (ID: 1)
============================================================
Detected source language: zh

Fields to translate: name → name_en, backstory → backstory_en, ...

[DRY RUN] Would translate the following:
  - name → name_en
  - backstory → backstory_en
  - opening_line → opening_line_en
  - default_state_json → default_state_json_en
```

### 4. 执行翻译

确认无误后，去掉 `--dry-run` 执行实际翻译：

```bash
python scripts/translate_characters.py --id 1
```

### 5. 验证结果

```bash
sqlite3 roleplay_chat.db "SELECT name, name_en, backstory, backstory_en FROM characters WHERE id = 1;"
```

## 📋 常用命令

### 翻译所有角色

```bash
python scripts/translate_characters.py --all
```

### 只翻译新建的角色（跳过已翻译）

```bash
python scripts/translate_characters.py --all --skip-existing
```

### 只翻译到英文

```bash
python scripts/translate_characters.py --all --target en
```

### 查看翻译进度

```bash
sqlite3 roleplay_chat.db "
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN backstory_en IS NOT NULL THEN 1 ELSE 0 END) as translated
FROM characters
WHERE is_deleted = 0;
"
```

## ⚙️ 集成到角色创建流程

在 `routes/characters.py` 或角色创建逻辑中添加：

```python
from services.translation_service import get_translation_service

# 创建角色后
character = Character(**character_data)
db.add(character)
db.commit()

# 自动翻译
translation_service = get_translation_service()
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

    character.name_en = translated.get("name")
    character.description_en = translated.get("description")
    character.backstory_en = translated.get("backstory")
    character.opening_line_en = translated.get("opening_line")
    character.default_state_json_en = translated.get("default_state_json")

    db.commit()
```

## 🔍 故障排查

### 问题 1：翻译没有生成

**检查步骤：**
1. 确认 `GROK_API_KEY` 已配置
2. 查看日志：`tail -f backend/logs/app.log | grep -i translation`
3. 测试 API 连接：

```python
from services.translation_service import get_translation_service
service = get_translation_service()
result = await service.translate_text("你好", "en")
print(result)  # Should output "Hello"
```

### 问题 2：翻译质量不佳

**解决方案：**
- 检查原文是否完整（不要有截断）
- 为 NSFW 内容确保使用 Grok API（不是 Gemini）
- 可以手动修改翻译后的 `_en` 字段

### 问题 3：状态 JSON 翻译错误

**检查状态 JSON 格式：**

```python
import json
state_json = character.default_state_json
state = json.loads(state_json)  # 应该成功解析
print(json.dumps(state, ensure_ascii=False, indent=2))
```

## 📊 翻译统计

### 查看翻译覆盖率

```sql
SELECT
  name,
  CASE
    WHEN name_en IS NOT NULL THEN '✓'
    ELSE '✗'
  END as name_translated,
  CASE
    WHEN backstory_en IS NOT NULL THEN '✓'
    ELSE '✗'
  END as backstory_translated,
  CASE
    WHEN opening_line_en IS NOT NULL THEN '✓'
    ELSE '✗'
  END as opening_line_translated
FROM characters
WHERE is_deleted = 0
LIMIT 10;
```

### 查看未翻译的角色

```sql
SELECT id, name
FROM characters
WHERE is_deleted = 0
  AND backstory_en IS NULL
ORDER BY created_at DESC;
```

## 🎯 最佳实践

### 1. 分批翻译

如果角色很多，建议分批处理：

```bash
# 翻译前 10 个角色
for i in {1..10}; do
  python scripts/translate_characters.py --id $i --skip-existing
  sleep 2  # 避免 API 限流
done
```

### 2. 定时翻译任务

使用 cron 定时翻译新角色：

```bash
# 每天凌晨 2 点翻译新角色
0 2 * * * cd /path/to/backend && python scripts/translate_characters.py --all --skip-existing
```

### 3. 翻译日志

保存翻译日志便于追踪：

```bash
python scripts/translate_characters.py --all > translations.log 2>&1
```

## 🔗 相关文档

- [完整文档](./LOCALIZATION.md) - 详细的系统说明
- [API 集成](./LOCALIZATION.md#api-返回多语言内容) - API 如何返回多语言内容
- [状态 JSON 翻译](./LOCALIZATION.md#状态-json-翻译) - 状态数据的翻译逻辑

## ⚡ 高级功能

### 自定义翻译提示词

如需调整翻译风格，编辑 `services/translation_service.py` 中的提示词：

```python
system_prompt = """你是一位专业的翻译专家...
（自定义你的要求）
"""
```

### 添加新语言支持

目前只支持中英互译。如需添加其他语言：

1. 在 `translate_text()` 中添加新的 `target_lang` 分支
2. 在数据库中添加对应的字段（如 `name_ja`）
3. 更新 key 映射表（`translate_state_json()` 中）

## 📞 需要帮助？

如果遇到问题：

1. 查看日志文件
2. 使用 `--dry-run` 预览翻译
3. 检查 GROK_API_KEY 是否有效
4. 阅读 [完整文档](./LOCALIZATION.md)
