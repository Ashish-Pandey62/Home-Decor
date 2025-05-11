from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import AsyncGenerator
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
from ...core.config import logger

router = APIRouter()

async def get_image_service():
    """
    Dependency that provides an ImageService instance
    """
    service = ImageService()
    try:
        yield service
    finally:
        pass

@router.post("/upload", response_model=ImageResponse)
async def upload_image(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
) -> ImageResponse:
    """
    Upload an image file for wall detection
    """
    logger.info(f"Received upload request for file: {file.filename}")
    try:
        # Save uploaded file
        logger.debug(f"Saving file {file.filename} with size {file.size} bytes")
        image_id, file_path = await FileService.save_upload(file)
        logger.info(f"File saved successfully with ID: {image_id}")
        
        # Schedule cleanup
        if background_tasks:
            logger.debug("Scheduling cleanup task")
            background_tasks.add_task(FileService.cleanup_old_files)
        
        response = ImageResponse(
            image_id=image_id,
            filename=file.filename,
            content_type=file.content_type,
            size=file.size,
            upload_url=FileService.get_file_url(file_path)
        )
        logger.info(f"Upload successful for image_id: {image_id}")
        return response
        
    except (InvalidImageError, StorageError) as e:
        logger.error(f"Upload failed: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": str(e)}
        )

@router.post("/detect-walls", response_model=WallDetectionResponse)
async def detect_walls(
    request: WallDetectionRequest,
    background_tasks: BackgroundTasks = None,
    image_service: ImageService = Depends(get_image_service)
) -> WallDetectionResponse:
    """
    Detect walls in an uploaded image
    """
    logger.info(f"Received wall detection request for image_id: {request.image_id}")
    try:
        # Get the file path from the image ID
        logger.debug(f"Getting file path for image_id: {request.image_id}")
        file_path = FileService.get_file_path(request.image_id)
        if not file_path.exists():
            logger.error(f"File not found at path: {file_path}")
            raise InvalidImageError("Image file not found")
        logger.debug(f"Found file at: {file_path}")
        
        # Process image and detect walls
        logger.info("Starting wall detection processing")
        result = await image_service.process_upload(
            request.image_id,
            file_path
        )
        logger.info(f"Wall detection completed. Found {len(result['walls'])} walls")
        
        # Schedule cleanup
        if background_tasks:
            logger.debug("Scheduling file cleanup")
            background_tasks.add_task(FileService.cleanup_old_files)
        
        response = WallDetectionResponse(
            image_id=request.image_id,
            walls=result['walls'],
            preview_url=result['preview_url']
        )
        logger.info(f"Wall detection successful for image_id: {request.image_id}")
        return response
        
    except (ImageProcessingError, InvalidImageError) as e:
        logger.error(f"Wall detection failed: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": str(e)}
        )

@router.post("/apply-color", response_model=ColorResponse)
async def apply_color(
    request: ColorRequest,
    background_tasks: BackgroundTasks = None,
    image_service: ImageService = Depends(get_image_service)
) -> ColorResponse:
    """
    Apply color to detected walls
    """
    logger.info(f"Received color application request for image_id: {request.image_id}")
    logger.debug(f"Color RGB: {request.color_rgb}, Wall IDs: {request.wall_ids}")
    
    # Check if original image exists
    file_path = FileService.get_file_path(request.image_id)
    if not file_path.exists():
        logger.error(f"Original image not found at: {file_path}")
        raise InvalidImageError("Original image not found. Please upload the image first.")
    try:
        # Apply color to walls
        logger.info("Starting color application process")
        result_path = await image_service.apply_wall_color(
            request.image_id,
            request.color_rgb,
            request.wall_ids
        )
        logger.debug(f"Color applied successfully, result saved to: {result_path}")
        
        # Create preview for comparison
        preview_path = result_path.parent / f"{request.image_id}_preview.jpg"
        logger.debug(f"Preview generated at: {preview_path}")
        
        # Schedule cleanup
        if background_tasks:
            logger.debug(f"Scheduling cache cleanup for image_id: {request.image_id}")
            background_tasks.add_task(image_service.cleanup_cache, request.image_id)
        
        response = ColorResponse(
            image_id=request.image_id,
            processed_image_url=FileService.get_file_url(result_path),
            preview_url=FileService.get_file_url(preview_path)
        )
        logger.info(f"Color application successful for image_id: {request.image_id}")
        return response
        
    except ImageProcessingError as e:
        logger.error(f"Color application failed: {str(e)}", exc_info=True)
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
    logger.debug("Health check requested")
    return {"status": "healthy"}