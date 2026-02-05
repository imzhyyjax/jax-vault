# JAX-VAULT 完整部署指南

## 🎯 部署架构

```
前端 (Vercel)  ←→  后端 (Railway)  ←→  数据库 (Railway PostgreSQL)
```

---

## 📋 部署前准备

### 1. 创建 GitHub 仓库（如果还没有）

```bash
cd /Users/jaxzhu/Desktop/jax-vault
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/jax-vault.git
git push -u origin main
```

---

## 🚂 第一步：部署后端到 Railway

### 1.1 创建 Railway 账号
1. 访问 https://railway.app
2. 用 GitHub 账号登录
3. 同意授权

### 1.2 创建数据库
1. 点击 **"New Project"**
2. 选择 **"Provision PostgreSQL"**
3. 等待数据库创建完成（约 30 秒）
4. 进入数据库设置，找到 **"Connect"** 选项卡
5. 复制 **"DATABASE_URL"**（类似：`postgresql://postgres:xxx@xxx.railway.app:5432/railway`）

### 1.3 部署后端代码
1. 在同一个项目中，点击 **"New Service"**
2. 选择 **"GitHub Repo"**
3. 选择你的 `jax-vault` 仓库
4. Railway 会自动检测到项目配置

### 1.4 配置环境变量
在后端 Service 的 **"Variables"** 选项卡添加：

```bash
# 数据库连接（粘贴刚才复制的）
DATABASE_URL=postgresql://postgres:xxx@xxx.railway.app:5432/railway

# CORS 允许的前端域名（先填这个，部署 Vercel 后再更新）
CORS_ORIGINS=http://localhost:3000,https://你的应用名.vercel.app

# API 密钥（自己生成一个随机字符串）
API_SECRET_KEY=your-random-secret-key-12345678
```

**生成随机密钥的方法：**
```bash
# 在终端运行
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 1.5 初始化数据库
1. 等待后端部署完成
2. 在 Railway 的后端 Service 中，点击 **"Settings"** → 找到你的域名（类似：`https://your-app.railway.app`）
3. 访问 `https://your-app.railway.app/system/init-db`（初始化数据库表结构）

### 1.6 获取后端 URL
- 复制后端的域名，格式：`https://your-app.railway.app`
- 保存下来，下一步配置前端要用

---

## ⚡ 第二步：部署前端到 Vercel

### 2.1 创建 Vercel 账号
1. 访问 https://vercel.com
2. 用 GitHub 账号登录

### 2.2 导入项目
1. 点击 **"Add New..."** → **"Project"**
2. 选择 `jax-vault` 仓库
3. 点击 **"Import"**

### 2.3 配置部署设置
在配置页面设置：

```bash
Framework Preset: Next.js
Root Directory: frontend
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 2.4 配置环境变量
添加环境变量：

```bash
# 后端 API 地址（填上一步获取的 Railway 域名）
NEXT_PUBLIC_API_BASE=https://your-app.railway.app

# API 密钥（和后端配置的一致）
NEXT_PUBLIC_API_KEY=your-random-secret-key-12345678
```

### 2.5 部署
1. 点击 **"Deploy"**
2. 等待构建完成（约 2-3 分钟）
3. 部署成功后，Vercel 会生成一个域名：`https://jax-vault.vercel.app`

### 2.6 更新 Railway CORS 配置
1. 回到 Railway 后端 Service
2. 更新环境变量 `CORS_ORIGINS`：
```bash
CORS_ORIGINS=http://localhost:3000,https://jax-vault.vercel.app
```
3. 后端会自动重新部署

---

## 🔐 第三步：添加 API 安全保护

### 3.1 后端验证中间件
已经准备好了（见下方代码更新）

### 3.2 前端自动附加密钥
已经准备好了（见下方代码更新）

---

## 📱 第四步：配置 PWA（可选但推荐）

让你的 Web 应用可以"添加到主屏幕"，用起来像真 App！

配置文件已经准备好了（见下方文件）

---

## ✅ 验证部署

### 1. 测试后端
访问：`https://your-app.railway.app/`
应该看到：
```json
{
  "status": "ok",
  "service": "JAX-VAULT API",
  "version": "0.1.0"
}
```

### 2. 测试前端
访问：`https://jax-vault.vercel.app/`
应该能正常看到页面并加载数据

### 3. 测试 PWA（iPhone）
1. 用 Safari 打开 `https://jax-vault.vercel.app/`
2. 点击底部"分享"按钮
3. 选择"添加到主屏幕"
4. 桌面上会出现应用图标

---

## 💰 费用预估

### Railway 免费额度
- 每月 $5 免费额度
- 约 500 小时运行时间
- 给几个朋友用完全够

### Vercel 免费额度
- 个人项目免费
- 100GB 带宽/月
- 无限部署次数

**总成本：$0/月** ✅

---

## 🔄 更新应用

### 更新后端
```bash
git add backend/
git commit -m "更新后端"
git push
```
Railway 会自动重新部署

### 更新前端
```bash
git add frontend/
git commit -m "更新前端"
git push
```
Vercel 会自动重新部署

---

## 🐛 常见问题

### Q: 前端显示 CORS 错误？
A: 检查 Railway 的 `CORS_ORIGINS` 环境变量是否包含你的 Vercel 域名

### Q: API 调用失败？
A: 检查前端的 `NEXT_PUBLIC_API_BASE` 是否正确，是否包含 `https://`

### Q: 数据库连接失败？
A: 检查 Railway 的 `DATABASE_URL` 环境变量是否正确

### Q: Railway 超出免费额度？
A: 暂停服务几天让额度重置，或升级到付费计划（$5/月）

---

## 🎉 完成！

现在你的应用已经上线了！

- 前端地址：https://jax-vault.vercel.app
- 后端地址：https://your-app.railway.app
- 24/7 在线
- 免费运行
- 自动更新

**分享给朋友：** 直接发送前端网址即可！

