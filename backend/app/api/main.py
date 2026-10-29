from fastapi import APIRouter

from app.api.routes import health, initial_data, transactions

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(initial_data.router)
api_router.include_router(transactions.router)
