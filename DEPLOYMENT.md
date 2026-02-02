# 部署指南

## 部署方案推荐

### 方案一：Vercel (前端) + Railway/Render (后端) - 推荐 ⭐

**优点**：免费额度充足，配置简单，适合个人项目

#### 前端部署到 Vercel
1. 访问 https://vercel.com
2. 使用 GitHub 账号登录
3. 导入你的 `jax-vault` 仓库
4. 配置：
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - **Environment Variables**:
     ```
     NEXT_PUBLIC_API_BASE=https://your-backend-url.com
     ```
5. 点击 Deploy

#### 后端部署到 Railway
1. 访问 https://railway.app
2. 使用 GitHub 账号登录
3. 点击 "New Project" > "Deploy from GitHub repo"
4. 选择 `jax-vault` 仓库
5. 配置：
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**:
     ```
     DATABASE_URL=your_postgresql_connection_string
     ```
6. Railway 会自动生成域名，复制到 Vercel 的环境变量中

### 方案二：Vercel (前端) + Render (后端)

#### 后端部署到 Render
1. 访问 https://render.com
2. 创建 "Web Service"
3. 连接 GitHub 仓库
4. 配置：
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**: 添加 `DATABASE_URL`

### 方案三：全栈部署到 Fly.io

适合想要统一管理的项目。

1. 安装 Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. 登录: `fly auth login`
3. 初始化: `fly launch` (在项目根目录)
4. 配置 `fly.toml` 文件
5. 部署: `fly deploy`

## 数据库部署

### 推荐：Supabase (PostgreSQL)
1. 访问 https://supabase.com
2. 创建新项目
3. 获取连接字符串
4. 在部署平台配置 `DATABASE_URL`

### 其他选项
- Railway PostgreSQL (与后端一起部署)
- Render PostgreSQL
- Neon (Serverless PostgreSQL)

## 环境变量配置

### 前端 (Vercel)
```
NEXT_PUBLIC_API_BASE=https://your-backend.railway.app
```

### 后端 (Railway/Render)
```
DATABASE_URL=postgresql://user:password@host:port/dbname
```

## 更新 CORS 配置

部署后需要更新 `backend/app/main.py` 中的 CORS 配置，添加生产环境的前端域名。

