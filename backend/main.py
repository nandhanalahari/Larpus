import psutil
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import connect_db, close_db
from services.face_service import load_model, is_model_loaded
from services.gemini_service import load_gemini
from routers import recognize, contacts, voice, payments, sol_price, transactions
from models.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    load_model()
    load_gemini()
    yield
    await close_db()


app = FastAPI(
    title="CIPHER API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recognize.router, prefix="/api/v1")
app.include_router(contacts.router, prefix="/api/v1")
app.include_router(voice.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(sol_price.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    mem = psutil.virtual_memory()
    return HealthResponse(
        status="ok",
        model_loaded=is_model_loaded(),
        memory_percent=mem.percent,
    )


if __name__ == "__main__":
    import uvicorn
    from config import get_settings
    settings = get_settings()
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
