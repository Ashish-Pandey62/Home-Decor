from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .api.endpoints import wall, test, decoration  # Added decoration endpoints
from .core.config import settings, setup_application
from .core.exceptions import BaseCustomException

# Setup application (creates directories and configures logging)
setup_application()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure file upload limits
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class UploadSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith(f"{settings.API_V1_STR}/wall/upload"):
            content_length = request.headers.get('content-length')
            if content_length and int(content_length) > 0:
                # Set max size to 10MB
                if int(content_length) > 20 * 1024 * 1024:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "File too large. Maximum size is 10MB"}
                    )
        return await call_next(request)

app.add_middleware(UploadSizeMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.1.64:5173","http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory=Path("static")), name="static")

# Include routers
app.include_router(wall.router, prefix=f"{settings.API_V1_STR}/wall", tags=["wall"])
app.include_router(test.router, prefix=f"{settings.API_V1_STR}/test", tags=["test"])  # Added test router
app.include_router(decoration.router, prefix=f"{settings.API_V1_STR}/decoration", tags=["decoration"])

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
# python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000