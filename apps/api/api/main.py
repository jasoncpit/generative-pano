import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .settings import get_settings
from .routers import generate as generate_router


def create_app() -> FastAPI:
    app = FastAPI()
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    async def healthz():
        return {"status": "ok"}

    @app.get("/heathz")
    async def heathz():
        return {"status": "ok", "hint": "use /healthz"}

    app.include_router(generate_router.router, prefix="/api/v1")
    return app


app = create_app()


