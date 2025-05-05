# HomeDécor Backend Implementation Plan

## Overview
This document outlines the implementation plan for the HomeDécor backend service using FastAPI. The backend will integrate the wall detection and recoloring functionality from the existing ML model.

## Technology Stack
- FastAPI: Web framework
- PyTorch: ML model execution
- OpenCV: Image processing
- Segment Anything Model (SAM): Wall detection
- Python-multipart: File uploads
- Pillow: Image handling
- Pydantic: Data validation

## Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        # Configuration settings
│   │   └── exceptions.py    # Custom exceptions
│   ├── models/
│   │   ├── __init__.py
│   │   ├── wall_detector.py # Wall detection model integration
│   │   └── schemas.py       # Pydantic models
│   ├── api/
│   │   ├── __init__.py
│   │   ├── endpoints/
│   │   │   ├── __init__.py
│   │   │   └── wall.py      # API route handlers
│   │   └── deps.py          # Dependencies and utilities
│   └── services/
│       ├── __init__.py
│       ├── file_service.py  # File handling operations
│       └── image_service.py # Image processing operations
├── tests/
│   └── test_api.py
├── static/
│   ├── uploads/            # Temporary storage for uploaded images
│   └── processed/          # Storage for processed images
└── requirements.txt
```

## API Endpoints

### 1. Image Upload
```
POST /api/upload
- Accepts multipart form data with image file
- Validates image format and size
- Returns: image_id and upload status
```

### 2. Wall Detection
```
POST /api/detect-walls
Request:
{
    "image_id": "string"
}
Response:
{
    "mask": "base64_encoded_mask",
    "wall_areas": [
        {
            "id": "string",
            "coordinates": [x, y, width, height]
        }
    ]
}
```

### 3. Apply Color
```
POST /api/apply-color
Request:
{
    "image_id": "string",
    "color_rgb": [r, g, b],
    "wall_areas": ["string"]  # IDs of walls to color
}
Response:
{
    "processed_image_url": "string",
    "preview_url": "string"
}
```

### 4. Get Image
```
GET /api/images/{image_id}
- Returns the processed image
- Query params for original/processed/preview versions
```

## Core Components

### 1. Wall Detection Model Integration
- Adapt WallRecoloringTool class from notebooks
- Optimize for API usage
- Add caching for model weights
- Implement batch processing capability

### 2. Image Processing Service
```python
class ImageService:
    async def store_upload(self, file: UploadFile) -> str
    async def process_image(self, image_path: str) -> ProcessedImage
    async def apply_color(self, image_id: str, color: RGB) -> str
    async def cleanup_old_files(self)
```

### 3. File Management
- Implement file storage strategy
- Handle concurrent uploads
- Cleanup mechanism for old files
- Secure file access

### 4. Error Handling
```python
class ImageProcessingError(Exception)
class InvalidImageError(Exception)
class StorageError(Exception)
class ModelError(Exception)
```

## Performance Considerations

1. **Image Processing**
   - Implement image resizing for large uploads
   - Add request timeout handling
   - Cache processed results

2. **Model Optimization**
   - Batch processing support
   - Model weight caching
   - GPU utilization when available

3. **Storage**
   - Implement file cleanup policy
   - Use async file operations
   - Consider CDN for static files

## Security Measures

1. **File Upload**
   - File size limits
   - File type validation
   - Malware scanning
   - Secure file names

2. **API Security**
   - Rate limiting
   - CORS configuration
   - Input validation
   - Error message sanitization

## Implementation Steps

1. **Initial Setup**
   - Create project structure
   - Install dependencies
   - Configure FastAPI application

2. **Core Features**
   - Implement file upload handling
   - Integrate wall detection model
   - Create image processing service
   - Set up file management system

3. **API Development**
   - Implement endpoints
   - Add request validation
   - Set up error handling
   - Add response models

4. **Testing**
   - Unit tests for services
   - Integration tests for API
   - Performance testing
   - Security testing

## Dependencies
```
fastapi>=0.68.0
python-multipart>=0.0.5
pillow>=8.3.2
torch>=1.9.0
opencv-python>=4.5.3
segment-anything @ git+https://github.com/facebookresearch/segment-anything.git
uvicorn>=0.15.0
python-jose>=3.3.0
pydantic>=1.8.2
aiofiles>=0.7.0
```

## Configuration
```python
class Settings(BaseSettings):
    PROJECT_NAME: str = "HomeDécor Backend"
    API_V1_STR: str = "/api"
    UPLOAD_DIR: Path = "static/uploads"
    PROCESSED_DIR: Path = "static/processed"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set = {".jpg", ".jpeg", ".png"}
    MODEL_PATH: str = "models/sam_vit_h_4b8939.pth"
    CLEANUP_INTERVAL: int = 3600  # 1 hour
```

## Testing Strategy

1. **Unit Tests**
   - Image processing functions
   - File management
   - Model integration
   - Utility functions

2. **Integration Tests**
   - API endpoints
   - End-to-end workflows
   - Error scenarios

3. **Performance Tests**
   - Upload handling
   - Processing speed
   - Concurrent requests