import os
import uvicorn
from fastapi import FastAPI
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
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )