"""PM Extension Service - FastAPI Application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import projects, gantt, resources, baseline, evm, health


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(gantt.router, prefix="/api/v1/gantt", tags=["gantt"])
app.include_router(resources.router, prefix="/api/v1/resources", tags=["resources"])
app.include_router(baseline.router, prefix="/api/v1/baseline", tags=["baseline"])
app.include_router(evm.router, prefix="/api/v1/evm", tags=["evm"])
