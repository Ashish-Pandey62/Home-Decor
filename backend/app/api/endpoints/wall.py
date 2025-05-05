from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from ...models.schemas import (
    WallDetectionResponse,
    ColorRequest,
    ColorResponse,
    ImageResponse,
    WallDetectionRequest
)
from ...services.file_service import FileService
from ...services.image_service import ImageService
from ...core.exceptions import (
    ImageProcessingError,
    InvalidImageError,
    StorageError
)
from typing import Dict

router = APIRouter()
image_service = ImageService()

@router.post("/upload", response_model=ImageResponse)
async def upload_image(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
) -> ImageResponse:
    """
    Upload an image file for wall detection
    """
    try:
        # Save uploaded file
        image_id, file_path = await FileService.save_upload(file)
        
        # Schedule cleanup
        if background_tasks:
            background_tasks.add_task(FileService.cleanup_old_files)
        
        return ImageResponse(
            image_id=image_id,
            filename=file.filename,
            content_type=file.content_type,
            size=file.size,
            upload_url=FileService.get_file_url(file_path)
        )
        
    except (InvalidImageError, StorageError) as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": str(e)}
        )

@router.post("/detect-walls", response_model=WallDetectionResponse)
async def detect_walls(
    request: WallDetectionRequest,
    background_tasks: BackgroundTasks = None
) -> WallDetectionResponse:
    """
    Detect walls in an uploaded image
    """
    try:
        # Process image and detect walls
        result = await image_service.process_upload(
            request.image_id,
            file_path  # This will be obtained from a file mapping service in production
        )
        
        # Schedule cleanup
        if background_tasks:
            background_tasks.add_task(image_service.cleanup_cache, request.image_id)
        
        return WallDetectionResponse(
            image_id=request.image_id,
            walls=result['walls'],
            preview_url=result['preview_url']
        )
        
    except (ImageProcessingError, InvalidImageError) as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": str(e)}
        )

@router.post("/apply-color", response_model=ColorResponse)
async def apply_color(
    request: ColorRequest,
    background_tasks: BackgroundTasks = None
) -> ColorResponse:
    """
    Apply color to detected walls
    """
    try:
        # Apply color to walls
        result_path = await image_service.apply_wall_color(
            request.image_id,
            request.color_rgb,
            request.wall_ids
        )
        
        # Create preview for comparison
        preview_path = result_path.parent / f"{request.image_id}_preview.jpg"
        
        # Schedule cleanup
        if background_tasks:
            background_tasks.add_task(image_service.cleanup_cache, request.image_id)
        
        return ColorResponse(
            image_id=request.image_id,
            processed_image_url=FileService.get_file_url(result_path),
            preview_url=FileService.get_file_url(preview_path)
        )
        
    except ImageProcessingError as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": str(e)}
        )

# Additional utility endpoints

@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint
    """
    return {"status": "healthy"}