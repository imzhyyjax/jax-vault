# 🚀 快速开始 - Vercel + Railway 部署

## ⚡ 5 分钟快速部署

### 第 1 步：部署后端到 Railway（2 分钟）

1. 访问 https://railway.app ，用 GitHub 登录
2. 点击 **"New Project"** → **"Provision PostgreSQL"**（创建数据库）
3. 等待数据库创建完成，复制 **DATABASE_URL**
4. 在同一项目中，点击 **"New Service"** → **"GitHub Repo"** → 选择 `jax-vault`
5. 在后端 Service 的 **Variables** 选项卡添加环境变量：

```bash
DATABASE_URL=postgresql://postgres:xxx@xxx.railway.app:5432/railway
CORS_ORIGINS=http://localhost:3000,https://你的应用名.vercel.app
```

6. 等待部署完成，复制后端域名（类似：`https://jax-vault-production.railway.app`）
7. 访问 `https://你的域名/system/init-db` 初始化数据库

---

### 第 2 步：部署前端到 Vercel（2 分钟）

1. 访问 https://vercel.com ，用 GitHub 登录
2. 点击 **"Add New..."** → **"Project"** → 选择 `jax-vault`
3. 配置：
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js（自动检测）
4. 添加环境变量：

```bash
NEXT_PUBLIC_API_BASE=https://你的Railway域名
```

5. 点击 **"Deploy"**，等待完成
6. 复制 Vercel 域名（类似：`https://jax-vault.vercel.app`）

---

### 第 3 步：更新 CORS 配置（1 分钟）

1. 回到 Railway 后端 Service
2. 更新 `CORS_ORIGINS` 环境变量：

```bash
CORS_ORIGINS=http://localhost:3000,https://jax-vault.vercel.app
```

---

## ✅ 完成！

- **前端地址**: https://jax-vault.vercel.app
- **后端地址**: https://jax-vault-production.railway.app
- **费用**: $0（免费额度足够个人使用）

---

## 📱 添加到 iPhone 主屏幕

1. 用 Safari 打开你的应用
2. 点击底部"分享"按钮
3. 选择"添加到主屏幕"
4. 完成！现在桌面上有你的应用图标了

---

## 🔄 更新应用

```bash
# 提交代码到 GitHub
git add .
git commit -m "更新"
git push

# Vercel 和 Railway 会自动部署最新版本
```

---

## 🔐 可选：添加 API 安全保护

### 生成密钥

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

复制输出的字符串（类似：`abc123xyz789...`）

### 配置后端（Railway）

添加环境变量：
```bash
API_SECRET_KEY=你生成的密钥
```

### 配置前端（Vercel）

添加环境变量：
```bash
NEXT_PUBLIC_API_KEY=你生成的密钥
```

两边配置相同的密钥即可。

**注意**：本地开发时不需要设置这个，只在部署到生产环境时使用。

---

## 🐛 遇到问题？

### CORS 错误
- 检查 Railway 的 `CORS_ORIGINS` 是否包含你的 Vercel 域名
- 确保没有多余的空格

### API 调用失败
- 检查 Vercel 的 `NEXT_PUBLIC_API_BASE` 是否正确
- 确保包含 `https://`，不要末尾加 `/`

### 数据库连接失败
- 访问 `https://你的后端域名/` 查看是否返回 JSON
- 检查 Railway 的 `DATABASE_URL` 是否正确

---

## 💰 费用说明

### Railway 免费额度
- 每月 $5 免费额度
- 约 500 小时运行时间
- 给几个朋友用完全够

### Vercel 免费额度
- 个人项目完全免费
- 100GB 带宽/月
- 无限部署次数

**总成本：$0/月** ✅

