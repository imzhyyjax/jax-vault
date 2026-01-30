# API 测试指南 - Apifox

## 🚀 快速开始

### 1. 启动后端服务

```bash
cd backend
python -m app.main
```

服务启动后访问：
- API 文档：http://127.0.0.1:8001/docs
- OpenAPI Schema：http://127.0.0.1:8001/openapi.json
- 健康检查：http://127.0.0.1:8001/

### 2. 在 Apifox 中导入 API

**方法一：导入 OpenAPI Schema（推荐）**

1. 打开 Apifox
2. 点击左侧菜单的"导入" → "OpenAPI"
3. 选择"URL导入"
4. 输入：`http://127.0.0.1:8001/openapi.json`
5. 点击"导入"

这样会自动导入所有接口和参数定义！

**方法二：手动创建环境**

1. 创建新环境，命名为"本地开发"
2. 设置基础 URL：`http://127.0.0.1:8001`
3. 手动添加接口

---

## 📋 测试用例示例

### 基础测试流程

#### 1. 健康检查
```
GET http://127.0.0.1:8001/
```

#### 2. 搜索基金（先测试已有接口）
```
GET http://127.0.0.1:8001/universe/funds?q=纳指&limit=10
```

#### 3. 创建投资组合
```
POST http://127.0.0.1:8001/portfolios/
Content-Type: application/json

{
  "name": "我的主组合",
  "include_in_overall": true
}
```

#### 4. 从基金库添加资产
```
POST http://127.0.0.1:8001/assets/from_universe
Content-Type: application/json

{
  "fund_code": "513100",
  "bucket": "progressive",
  "subclass": "US_EQ",
  "status": "holding"
}
```

#### 5. 获取资产列表
```
GET http://127.0.0.1:8001/assets/
```

#### 6. 获取组合列表（带统计）
```
GET http://127.0.0.1:8001/portfolios/
```

#### 7. 获取资产统计
```
GET http://127.0.0.1:8001/assets/stats/summary
```

---

## 🎯 完整测试场景

### 场景 1：添加基金到资产字典

1. **搜索基金**
   ```
   GET /universe/funds?q=513100
   ```
   找到基金代码：`513100`

2. **添加到资产**
   ```
   POST /assets/from_universe
   {
     "fund_code": "513100",
     "bucket": "progressive",
     "subclass": "US_EQ",
     "status": "holding"
   }
   ```

3. **查看资产列表**
   ```
   GET /assets/?status=holding
   ```

### 场景 2：创建和管理组合

1. **创建组合**
   ```
   POST /portfolios/
   {
     "name": "美股组合",
     "include_in_overall": true
   }
   ```
   记住返回的 `id`

2. **查看组合详情**
   ```
   GET /portfolios/{id}
   ```

3. **更新组合**
   ```
   PUT /portfolios/{id}
   {
     "name": "美股+港股组合",
     "include_in_overall": true
   }
   ```

---

## 📝 参数说明

### Assets API 参数

**bucket（资产类型）：**
- `progressive` - 进攻型
- `defensive` - 防守型

**subclass（子类）：**
- 进攻型：`CN_A`, `HK_EQ`, `US_EQ`, `GLOBAL_EQ`
- 防守型：`DIVIDEND`, `BOND`, `PRECIOUS_METAL`, `CASH`

**status（状态）：**
- `holding` - 持有中
- `watchlist` - 观察中
- `archived` - 已归档

**market（市场）：**
- `CN` - 中国
- `US` - 美国
- `HK` - 香港

---

## ⚠️ 注意事项

1. **数据库连接**：确保 PostgreSQL 已启动，数据库已初始化
2. **基金库数据**：如果 `fund_universe_cn` 表为空，先运行同步脚本：
   ```bash
   python backend/scripts/sync_fund_universe.py
   ```
3. **错误处理**：如果遇到 404 或 400 错误，查看响应体的 `detail` 字段了解原因

---

## 🔍 常见问题

**Q: 导入 OpenAPI 后接口没有分组？**
A: 在 Apifox 中，接口会根据 `tags` 自动分组（Assets, Portfolios, Universe）

**Q: 如何保存测试数据？**
A: 在 Apifox 中可以创建"测试用例"，保存常用的请求参数

**Q: 如何测试需要关联数据的接口？**
A: 先创建组合，再添加资产，然后测试其他接口

