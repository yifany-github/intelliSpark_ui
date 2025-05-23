# ProductInsightAI

一个基于 AI 的角色扮演聊天应用，让用户可以选择不同的场景和角色，与 AI 进行沉浸式对话体验。

## 🌟 项目特色

- **🎭 多角色扮演**：与不同性格的 AI 角色互动
- **🏰 多种场景**：皇家宫廷、太空探索、未来都市等丰富场景
- **🤖 智能对话**：基于 OpenAI GPT-4 的高质量 AI 对话
- **🎨 现代界面**：使用 React + TypeScript + Tailwind CSS 构建的美观 UI
- **⚡ 实时体验**：快速响应的聊天体验

## 🛠 技术栈

### 前端
- **React 18** - 用户界面框架
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Radix UI** - 无障碍组件库

### 后端
- **Node.js** - JavaScript 运行时
- **Express** - Web 应用框架
- **TypeScript** - 服务端类型安全
- **OpenAI API** - AI 对话能力
- **Drizzle ORM** - 数据库 ORM

### 数据库
- **PostgreSQL** - 主数据库（可选，使用 Neon 云数据库）

## 📋 前提条件

确保你的系统已安装以下软件：

- **Node.js** >= 16.0.0
- **npm** 或 **yarn**
- **OpenAI API Key**（必需）

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd ProductInsightAI
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境配置

创建 `.env` 文件：

```bash
# OpenAI API 配置（必需）
OPENAI_API_KEY=your_openai_api_key_here

# 数据库配置（可选，有默认数据）
DATABASE_URL=your_postgresql_connection_string
```

**获取 OpenAI API Key：**
1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 注册/登录账户
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 将 API Key 添加到 `.env` 文件中

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:5000` 启动

### 5. 访问应用

在浏览器中打开 [http://localhost:5000](http://localhost:5000)

## 📱 使用指南

### 基本使用流程

1. **选择场景**：从多个预设场景中选择一个（皇家宫廷、太空探索等）
2. **选择角色**：选择你想要对话的 AI 角色
3. **开始对话**：在聊天界面中与 AI 角色进行对话
4. **角色扮演**：AI 会根据角色设定和场景背景回应你的消息

### 可用场景

- **🏰 Royal Court** - 中世纪宫廷阴谋
- **🚀 Star Voyager** - 深空探索冒险
- **🌃 Neo Tokyo** - 未来主义都市冒险
- **🏝️ Tropical Getaway** - 天堂岛屿度假村
- **🌲 Enchanted Woods** - 魔法森林冒险
- **☢️ Wasteland** - 废土生存

### 角色类型

每个角色都有独特的：
- **背景故事**
- **性格特征**
- **说话风格**
- **行为模式**

## 🔧 开发

### 项目结构

```
ProductInsightAI/
├── client/                 # 前端代码
│   └── src/
├── server/                 # 后端代码
│   ├── index.ts           # 服务器入口
│   ├── routes.ts          # API 路由
│   ├── storage.ts         # 数据存储
│   └── services/
│       └── openai.ts      # OpenAI 集成
├── shared/                # 共享类型定义
├── package.json
└── README.md
```

### 可用脚本

```bash
# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 类型检查
npm run check

# 数据库推送（如果使用数据库）
npm run db:push
```

### API 端点

#### 场景 API
- `GET /api/scenes` - 获取所有场景
- `GET /api/scenes/:id` - 获取特定场景

#### 角色 API
- `GET /api/characters` - 获取所有角色
- `GET /api/characters/:id` - 获取特定角色

#### 聊天 API
- `GET /api/chats` - 获取所有聊天记录
- `POST /api/chats` - 创建新聊天
- `GET /api/chats/:id` - 获取特定聊天
- `GET /api/chats/:id/messages` - 获取聊天消息
- `POST /api/chats/:id/messages` - 发送消息
- `POST /api/chats/:id/generate` - 生成 AI 回复

## 🔍 故障排除

### 常见问题

#### 1. OpenAI API 连接失败

**症状**：看到 "Using simulated responses" 警告

**解决方案**：
1. 检查 `.env` 文件是否存在且包含有效的 `OPENAI_API_KEY`
2. 确认 API Key 格式正确（以 `sk-` 开头）
3. 验证 API Key 是否有效：
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" https://api.openai.com/v1/models
   ```

#### 2. 端口 5000 被占用

**症状**：`EADDRINUSE: address already in use :::5000`

**解决方案**：
```bash
# 查找占用端口的进程
lsof -i :5000

# 终止进程
kill -9 <PID>
```

#### 3. 网络绑定错误 (macOS)

**症状**：`ENOTSUP: operation not supported on socket 0.0.0.0:5000`

**解决方案**：项目已配置为使用 `localhost` 而非 `0.0.0.0`，如果仍有问题，请重启服务器。

#### 4. 模块找不到错误

**解决方案**：
```bash
# 清除 node_modules 并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 验证安装

运行以下命令验证各组件是否正常工作：

```bash
# 检查服务器状态
curl http://localhost:5000

# 检查 API 响应
curl http://localhost:5000/api/scenes

# 检查 OpenAI 集成（应该看到智能回复，而非模板回复）
curl -X POST "http://localhost:5000/api/chats" \
     -H "Content-Type: application/json" \
     -d '{"sceneId": 1, "characterId": 1, "title": "Test"}'
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如果遇到问题，请：
1. 查看故障排除部分
2. 检查 [Issues](link-to-issues)
3. 创建新的 Issue 描述问题

---

**享受与 AI 角色的对话体验！** 🎭✨ 