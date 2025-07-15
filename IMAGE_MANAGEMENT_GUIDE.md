# Admin图片管理系统使用指南

## 概述

已经成功为admin界面实现了完整的图片管理功能，管理员可以方便地为角色和场景选择图片。

## 图片存储位置

### 角色图片
- **目录**: `/attached_assets/characters_img/`
- **URL格式**: `/assets/characters_img/文件名.扩展名`

### 场景图片
- **目录**: `/attached_assets/scenes_img/`
- **URL格式**: `/assets/scenes_img/文件名.扩展名`

## 支持的图片格式

- JPG/JPEG
- PNG
- GIF
- WebP

## 使用方法

### 1. 添加图片文件

将图片文件直接放入相应的目录：

```bash
# 角色图片
cp your_character.jpg attached_assets/characters_img/

# 场景图片
cp your_scene.png attached_assets/scenes_img/
```

### 2. 在Admin界面中选择图片

1. 登录admin界面
2. 进入"Characters"或"Scenes"标签
3. 点击"Add Character"或"Add Scene"
4. 在图片字段中：
   - 点击"Browse"按钮打开图片选择器
   - 使用搜索功能查找特定图片
   - 点击图片进行选择
   - 或者手动输入图片URL

### 3. 图片选择器功能

- **图片网格**: 显示所有可用图片的缩略图
- **搜索功能**: 通过文件名搜索图片
- **预览功能**: 选择图片后显示预览
- **手动URL输入**: 支持输入外部图片URL
- **响应式设计**: 适配不同屏幕尺寸

## API接口

### 获取图片列表

```
GET /api/admin/assets/images?asset_type=characters
GET /api/admin/assets/images?asset_type=scenes
```

**响应格式:**
```json
{
  "images": [
    {
      "filename": "Elara.jpeg",
      "name": "Elara",
      "url": "/assets/characters_img/Elara.jpeg",
      "size": 12345
    }
  ]
}
```

## 图片预览

### 角色卡片
- 在admin界面的角色管理中，每个角色卡片显示圆形头像
- 支持错误处理，如果图片加载失败会显示默认图标

### 场景卡片
- 在admin界面的场景管理中，每个场景卡片显示矩形预览图
- 支持错误处理，如果图片加载失败会显示默认图标

## 前端集成

图片URL会自动同步到：
- Characters页面的角色网格
- Chat界面的角色头像
- Scene页面的场景预览

确保了整个应用中图片显示的一致性。

## 故障排除

### 1. 图片不显示
- 检查图片文件是否存在于正确的目录中
- 确认图片文件格式被支持
- 检查文件权限

### 2. API返回"No images found"
- 确认 `attached_assets/characters_img/` 或 `attached_assets/scenes_img/` 目录存在
- 确认目录中有图片文件
- 检查后端日志中的错误信息

### 3. 图片选择器无法打开
- 确认admin已登录
- 检查浏览器控制台的错误信息
- 确认网络连接正常

## 目录结构

```
attached_assets/
├── characters_img/
│   ├── Elara.jpeg
│   ├── character1.jpg
│   └── character2.png
└── scenes_img/
    ├── royal_court.jpeg
    ├── scene1.jpg
    └── scene2.png
```

## 扩展功能

当前系统已经预留了图片上传功能的接口，未来可以扩展：
- 直接在admin界面上传图片
- 图片尺寸调整
- 图片格式转换
- 批量图片管理

## 技术实现

- **后端**: FastAPI with SQLAlchemy
- **前端**: React with TypeScript
- **UI组件**: Radix UI + Tailwind CSS
- **图片处理**: 原生Web APIs
- **状态管理**: TanStack Query

该系统提供了完整的图片管理解决方案，满足了admin界面对图片选择和管理的需求。