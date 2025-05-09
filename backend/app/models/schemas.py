from pydantic import BaseModel, Field, validator
from typing import List, Tuple, Optional
from pathlib import Path
import re

class WallMask(BaseModel):
    mask_id: str = Field(..., description="Unique identifier for the wall mask")
    svg_path: str = Field(..., description="SVG path representation of wall mask")
    area: int = Field(..., description="Area of the wall in pixels")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score of the wall detection")
    dimensions: Tuple[int, int] = Field(..., description="Original image dimensions (width, height)")

class WallDetectionResponse(BaseModel):
    image_id: str
    walls: List[WallMask]
    preview_url: str

class ColorRequest(BaseModel):
    image_id: str
    color_rgb: Tuple[int, int, int] = Field(..., description="RGB color values")
    wall_ids: List[str] = Field(..., description="List of wall IDs to color")

    @validator('color_rgb')
    def validate_rgb(cls, v):
        if not all(isinstance(c, int) and 0 <= c <= 255 for c in v):
            raise ValueError('RGB values must be integers between 0 and 255')
        return v

class ColorResponse(BaseModel):
    image_id: str
    processed_image_url: str
    preview_url: str

class ImageResponse(BaseModel):
    image_id: str = Field(..., description="Unique identifier for the uploaded image")
    filename: str
    content_type: str
    size: int
    upload_url: str

class ErrorResponse(BaseModel):
    detail: str
    error_code: str = Field(..., pattern="^[A-Z_]+$")
    
class ProcessingStatus(BaseModel):
    status: str = Field(..., pattern="^(success|error|processing)$")
    progress: Optional[float] = Field(None, ge=0, le=100)
    message: Optional[str] = None

class WallDetectionRequest(BaseModel):
    image_id: str = Field(..., description="ID of the uploaded image to process")
    
    @validator('image_id')
    def validate_image_id(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid image ID format')
        return v