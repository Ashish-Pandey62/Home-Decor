from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .api.endpoints import wall, test  # Added test endpoints
from .core.config import settings, create_directories
from .core.exceptions import BaseCustomException

# Create required directories
create_directories()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory=Path("static")), name="static")

# Include routers
app.include_router(wall.router, prefix=f"{settings.API_V1_STR}/wall", tags=["wall"])
app.include_router(test.router, prefix=f"{settings.API_V1_STR}/test", tags=["test"])  # Added test router

# Exception handlers
@app.exception_handler(BaseCustomException)
async def custom_exception_handler(request: Request, exc: BaseCustomException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.__class__.__name__.upper()
        }
    )

@app.get("/")
async def root():
    return {
        "message": "Welcome to HomeDécor API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "test_url": f"{settings.API_V1_STR}/test/ping"  # Added test endpoint info
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

# python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
