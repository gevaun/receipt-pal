from dotenv import load_dotenv
from fastapi import FastAPI

from app.api.main import api_router
from app.core.config import settings
from app.logging_config import setup_logging

load_dotenv()
setup_logging()

app = FastAPI(title=settings.app_name)
app.include_router(api_router)
