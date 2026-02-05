import os
import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.api import universe, assets, portfolios, overall, trades, holdings, prices, system, estimates

app = FastAPI(
    title="JAX-VAULT API",
    description="Personal Quant & Portfolio Management System",
    version="0.1.0"
)

# CORS 配置 - 允许前端访问
# 从环境变量读取允许的源，支持多个域名（用逗号分隔）
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 安全验证中间件（可选，用于生产环境）
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "")

async def verify_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    """
    验证 API 密钥（仅在设置了 API_SECRET_KEY 环境变量时启用）
    本地开发时不设置此变量，部署到生产环境时设置
    """
    # 如果没有设置 API_SECRET_KEY，跳过验证（本地开发）
    if not API_SECRET_KEY:
        return True
    
    # 生产环境：验证密钥
    if not x_api_key or x_api_key != API_SECRET_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing API key"
        )
    return True

# 注册路由
app.include_router(universe.router)
app.include_router(assets.router)
app.include_router(portfolios.router)
app.include_router(overall.router)
app.include_router(trades.router)
app.include_router(holdings.router)
app.include_router(prices.router)
app.include_router(system.router)
app.include_router(estimates.router)


@app.get("/")
def health():
    return {
        "status": "ok",
        "service": "JAX-VAULT API",
        "version": "0.1.0"
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )