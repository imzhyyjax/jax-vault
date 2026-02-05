# 📱 PWA 配置指南

## 什么是 PWA？

PWA (Progressive Web App) 可以让你的 Web 应用：
- 添加到手机主屏幕
- 全屏运行（没有浏览器地址栏）
- 有独立的应用图标
- 体验接近原生 App

**已完成配置** ✅

---

## 创建应用图标

### 快速方法：使用在线工具

1. 访问 https://realfavicongenerator.net/
2. 上传一张正方形图片（推荐 1024x1024）
3. 下载生成的图标包
4. 将以下文件复制到 `frontend/public/` 目录：
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)

### 手动创建

使用任何图片编辑工具（如 Photoshop、Figma、Canva）创建：
- **icon-192.png**: 192x192 像素
- **icon-512.png**: 512x512 像素

**设计建议：**
- 简洁明了的图标
- 使用品牌色
- 确保在小尺寸下清晰可见
- 建议使用纯色背景

---

## 配置文件说明

### manifest.json

已创建：`frontend/public/manifest.json`

```json
{
  "name": "JAX-VAULT",              // 应用全名
  "short_name": "JAX-VAULT",        // 短名称（主屏幕显示）
  "description": "个人量化投资与组合管理系统",
  "start_url": "/",                 // 启动地址
  "display": "standalone",          // 全屏显示
  "background_color": "#ffffff",    // 背景色
  "theme_color": "#000000",         // 主题色
  "icons": [...]                    // 图标配置
}
```

### layout.tsx

已更新：`frontend/src/app/layout.tsx`

添加了：
- PWA manifest 链接
- Apple Web App 配置
- 移动端视口设置

---

## 如何使用

### iPhone / iPad (Safari)

1. 用 Safari 打开你的应用
2. 点击底部"分享"按钮（方框带向上箭头）
3. 向下滚动，选择"添加到主屏幕"
4. 编辑名称（可选），点击"添加"
5. 完成！桌面上会出现应用图标

### Android (Chrome)

1. 用 Chrome 打开你的应用
2. 点击右上角菜单（三个点）
3. 选择"添加到主屏幕"或"安装应用"
4. 点击"添加"
5. 完成！

---

## 效果对比

### 普通网页
```
[地址栏: example.com]
━━━━━━━━━━━━━━━━━━━━━
|                    |
|    你的网页内容     |
|                    |
━━━━━━━━━━━━━━━━━━━━━
[工具栏: ← → ⟳ ⋮]
```

### PWA 模式
```
━━━━━━━━━━━━━━━━━━━━━
|                    |
|    你的应用内容     |
|   (全屏显示)       |
|                    |
━━━━━━━━━━━━━━━━━━━━━
```

**区别：**
- ✅ 没有地址栏
- ✅ 没有浏览器工具栏
- ✅ 独立的应用图标
- ✅ 更沉浸的体验

---

## 高级功能（可选）

### 1. 离线缓存

创建 `frontend/public/sw.js`（Service Worker）：

```javascript
// 缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('jax-vault-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icon-192.png',
      ]);
    })
  );
});
```

### 2. 推送通知

需要后端配置，暂时不推荐（复杂度高）

### 3. 自定义启动画面

在 `manifest.json` 中配置 `background_color` 和 `theme_color`

---

## 验证 PWA 配置

### Chrome DevTools

1. 打开你的应用
2. 按 F12 打开开发者工具
3. 切换到 "Application" 标签
4. 左侧选择 "Manifest"
5. 检查是否正确识别

### Lighthouse 测试

1. Chrome DevTools → "Lighthouse" 标签
2. 选择 "Progressive Web App"
3. 点击 "Generate report"
4. 查看 PWA 分数和建议

---

## 常见问题

### Q: 为什么 iPhone 上没有"添加到主屏幕"选项？
A: 必须使用 Safari 浏览器，Chrome 或其他浏览器不支持。

### Q: 图标显示不正确？
A: 检查图标文件是否存在于 `frontend/public/` 目录，文件名是否正确。

### Q: 添加后打开还是显示地址栏？
A: 检查 `manifest.json` 中的 `display` 是否为 `"standalone"`。

### Q: 需要提交 App Store 审核吗？
A: 不需要！PWA 不需要任何审核，用户直接添加即可。

---

## 对比 Native App

| 特性 | PWA | Native App |
|------|-----|------------|
| **开发成本** | ✅ 低（复用 Web 代码） | ❌ 高（需要重写） |
| **发布流程** | ✅ 无需审核 | ❌ 需要 App Store 审核 |
| **更新速度** | ✅ 即时更新 | ❌ 需要用户下载更新 |
| **跨平台** | ✅ iOS + Android 通用 | ❌ 需要分别开发 |
| **性能** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **原生功能** | ⚠️ 部分支持 | ✅ 完全支持 |
| **离线使用** | ✅ 支持（需配置） | ✅ 完全支持 |
| **年费** | ✅ $0 | ❌ $99/年（iOS） |

**结论：给自己和朋友用，PWA 完全够了！**

