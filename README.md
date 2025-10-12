# ProductInsightAI

一个基于 AI 的角色扮演聊天应用，让用户可以选择不同的场景和角色，与 AI 进行沉浸式对话体验。

## 🌟 项目特色

- **🎭 多角色扮演**：与不同性格的 AI 角色互动
- **🏰 多种场景**：皇家宫廷、太空探索、未来都市等丰富场景
- **🤖 智能对话**：基于 Gemini AI 的高质量 AI 对话
- **🔐 现代认证**：邮箱登录 + Google OAuth 社交登录
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
- **Python** - 编程语言
- **FastAPI** - 现代 Python Web 框架
- **SQLAlchemy** - Python ORM
- **Gemini AI** - AI 对话能力
- **Supabase Auth** - 身份验证服务
- **JWT** - JSON Web Token 认证

### 数据库
- **SQLite** - 开发环境数据库
- **PostgreSQL** - 生产环境数据库（可选）

## 📋 前提条件

确保你的系统已安装以下软件：

- **Node.js** >= 16.0.0 (前端)
- **Python** >= 3.8 (后端)
- **npm** 或 **yarn**
- **Gemini API Key**（必需）
- **Supabase 项目**（用于身份验证）

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

#### 前端环境变量 (根目录 `.env`)：

```bash
# Supabase 配置（必需，用于身份验证）
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
# 可选：自定义 OAuth 回调地址（默认使用当前站点）
# VITE_SUPABASE_REDIRECT_URL=http://localhost:5173/auth/callback
```

#### 后端环境变量 (`backend/.env`)：

```bash
# 数据库配置
DATABASE_URL=sqlite:///./roleplay_chat.db

# 身份验证配置
SECRET_KEY=your-jwt-secret-key
ADMIN_JWT_SECRET=your-admin-jwt-secret

# Supabase 服务配置
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_STORAGE_BUCKET=attachments

# AI 服务配置
GEMINI_API_KEY=your-gemini-api-key
```

#### 获取必需的 API Keys：

**1. Gemini API Key：**
1. 访问 [Google AI Studio](https://makersuite.google.com/)
2. 创建新的 API Key
3. 将 API Key 添加到 `backend/.env` 文件中

**2. Supabase 配置：**
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard) 并创建项目
2. 在 **Settings → API** 中获取 `Project URL`、`anon` 公钥、`service_role` 密钥 和 `JWT secret`
3. 在 **Authentication → Providers** 中启用 Email 登录与 Google OAuth
4. 创建用于存储头像/角色资源的 Storage Bucket（例如 `attachments`）
5. 将上述信息填入根目录 `.env` 与 `backend/.env`

### 4. 启动开发服务器

#### 启动前端 (在根目录)：
```bash
npm run dev
```

#### 启动后端 (在新终端，切换到 backend 目录)：
```bash
cd backend
python main.py
```

前端开发服务器将在 `http://localhost:5173` 启动，后端 API 服务器将在 `http://localhost:8000` 启动

### 5. 访问应用

在浏览器中打开 [http://localhost:5173](http://localhost:5173)

## 📱 使用指南

### 基本使用流程

1. **注册/登录**：使用邮箱注册账户或通过 Google 账户登录
2. **选择场景**：从多个预设场景中选择一个（皇家宫廷、太空探索等）
3. **选择角色**：选择你想要对话的 AI 角色
4. **开始对话**：在聊天界面中与 AI 角色进行对话
5. **角色扮演**：AI 会根据角色设定和场景背景回应你的消息

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
├── backend/               # 后端代码
│   ├── main.py           # 服务器入口
│   ├── models.py         # 数据库模型
│   ├── auth/             # 认证模块
│   └── services/         # 业务服务
├── .env                  # 前端环境变量
├── backend/.env          # 后端环境变量
├── package.json
└── README.md
```

### 🛠 开发环境清理和重置

当遇到问题或需要重新开始时，请按以下顺序执行清理操作：

#### 1. 清理缓存和临时文件
```bash
# 清理 Vite 缓存
rm -rf node_modules/.vite

# 清理 Python 缓存
find backend -name "__pycache__" -type d -exec rm -rf {} +
find backend -name "*.pyc" -type f -delete

# 清理 npm 缓存（可选）
npm cache clean --force
```

#### 2. 重置数据库
```bash
# 删除现有数据库文件
rm -f backend/roleplay_chat.db

# 重启后端服务器将自动重新创建数据库
```

#### 3. 重新安装依赖
```bash
# 删除 node_modules 并重新安装
rm -rf node_modules package-lock.json
npm install
```

#### 4. 必需文件检查清单

确保以下文件存在且配置正确：

**根目录 `.env` 文件**：
```bash
# Supabase 配置（必需）
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

**backend/.env 文件**：
```bash
# 数据库配置
DATABASE_URL=sqlite:///./roleplay_chat.db

# 身份验证配置
SECRET_KEY=your-jwt-secret-key-here
ADMIN_JWT_SECRET=your-admin-jwt-secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_STORAGE_BUCKET=attachments

# AI 服务配置
GEMINI_API_KEY=your-gemini-api-key
```

#### 5. 完整重置流程
如果需要完全重置开发环境：

```bash
# 1. 停止所有服务器
# Ctrl+C 停止前端和后端服务器

# 2. 完全清理
rm -rf node_modules package-lock.json
rm -rf node_modules/.vite
rm -f backend/roleplay_chat.db
find backend -name "__pycache__" -type d -exec rm -rf {} +

# 3. 重新安装
npm install

# 4. 检查环境变量文件
ls -la .env backend/.env

# 5. 重新启动服务器
npm run dev  # 前端
# 在新终端中：
cd backend && python main.py  # 后端
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

#### 身份验证 API
- `GET /api/auth/me` - 获取当前登录用户信息（需要 Supabase JWT）
- `GET /api/auth/me/stats` - 获取当前用户统计数据
- `GET /api/auth/check-username` - 检查用户名是否可用
- `PUT /api/auth/profile` - 更新用户资料与头像
- `POST /api/auth/logout` - 登出（由 Supabase 管理会话）

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

#### 1. Supabase 身份验证失败

**症状**：出现 "Supabase credentials missing" 或频繁 `401 Unauthorized`

**解决方案**：
1. 检查根目录 `.env` 是否包含 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`
2. 确认 `backend/.env` 配置了 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 和 `SUPABASE_JWT_SECRET`
3. 在 Supabase Dashboard → Authentication 中启用 Email 登录与 Google OAuth
4. 重启前后端服务器以加载最新环境变量

#### 2. Gemini AI 连接失败

**症状**：AI 回复失败或使用模拟回复

**解决方案**：
1. 检查 `backend/.env` 文件是否包含有效的 `GEMINI_API_KEY`
2. 确认 API Key 格式正确
3. 验证 API Key 是否有效

#### 3. 端口被占用

**症状**：`EADDRINUSE: address already in use`

**解决方案**：
```bash
# 查找占用端口的进程 (前端端口 5173)
lsof -i :5173

# 或者查找后端端口 8000
lsof -i :8000

# 终止进程
kill -9 <PID>
```

#### 4. 数据库模式错误

**症状**：`no such column` 错误

**解决方案**：
```bash
# 删除旧数据库文件让系统重新创建
rm backend/roleplay_chat.db
# 重启后端服务器
```

#### 5. 模块找不到错误

**解决方案**：
```bash
# 清除 node_modules 并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 验证安装

运行以下命令验证各组件是否正常工作：

```bash
# 检查前端服务器状态
curl http://localhost:5173

# 检查后端 API 健康状态
curl http://localhost:8000/health

# 检查身份验证 API
curl http://localhost:8000/api/scenes

# 检查数据库连接（应该返回场景列表）
curl http://localhost:8000/api/characters
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
