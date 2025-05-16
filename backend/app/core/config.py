from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Set, Optional
from functools import lru_cache
import logging
import logging.handlers
import sys

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

    # Gemini AI Settings
    GEMINI_API_KEY: Optional[str] = None
    
    # File Cleanup
    CLEANUP_INTERVAL: int = 3600  # 1 hour
    MAX_FILE_AGE: int = 24 * 3600  # 24 hours
    # CORS Settings
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://192.168.1.64:3000",
        "http://192.168.1.64:8000",
        "http://192.168.1.64:5173",
        "http://localhost"
        "http://192.168.1.64:5173",
    ]  # Allowed origins
    
    class Config:
        case_sensitive = True
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

# Initialize settings
settings = get_settings()

# Configure logging and create directories
def setup_application():
    # Create required directories
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    settings.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create logs directory with absolute path
    logs_dir = Path(__file__).parent.parent.parent / 'logs'
    logs_dir.mkdir(parents=True, exist_ok=True)
    
    # Setup logging
    logger = logging.getLogger('app')
    logger.setLevel(logging.DEBUG)

    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    
    # File handler for detailed logs
    log_file = logs_dir / 'app.log'
    file_handler = logging.handlers.RotatingFileHandler(
        str(log_file),
        maxBytes=1024*1024,  # 1MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(pathname)s:%(lineno)d - %(message)s'
    )
    file_handler.setFormatter(file_format)
    
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    return logger

# Initialize application (create directories and setup logging)
logger = setup_application()
logger.info("Application directories and logging initialized")