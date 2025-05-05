from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Set
from functools import lru_cache

class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "HomeDécor Backend"
    API_V1_STR: str = "/api"
    
    # File Storage
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "static/uploads"
    PROCESSED_DIR: Path = BASE_DIR / "static/processed"
    
    # Upload Settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: Set[str] = {".jpg", ".jpeg", ".png"}
    
    # Model Settings
    MODEL_PATH: Path = BASE_DIR.parent / "models/sam_vit_h_4b8939.pth"
    MODEL_TYPE: str = "vit_h"
    DEVICE: str = "cuda" if False else "cpu"  # We'll add CUDA check later
    
    # File Cleanup
    CLEANUP_INTERVAL: int = 3600  # 1 hour
    MAX_FILE_AGE: int = 24 * 3600  # 24 hours
    
    # CORS Settings
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:5173",  # Vite default dev server
        "http://localhost:3000",
        "http://localhost:8080",
    ]
    
    class Config:
        case_sensitive = True
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

# Create required directories
def create_directories():
    settings = get_settings()
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    settings.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Initialize settings
settings = get_settings()