from pydantic import BaseModel, Field, validator
from typing import List, Tuple, Optional
from pathlib import Path
import re

class WallDetectionResponse(BaseModel):
    image_id: str
    mask: str = Field(..., description="SVG path data for the wall mask")
    preview_url: str

class ColorRequest(BaseModel):
    image_id: str
    color_rgb: Tuple[int, int, int] = Field(..., description="RGB color values")

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

class RecommendationRequest(BaseModel):
    image_id: str = Field(..., description="ID of the uploaded image to process")
    num_colors: Optional[int] = Field(4, ge=1, le=10, description="Number of color recommendations to generate")
    
    @validator('image_id')
    def validate_image_id(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid image ID format')
        return v

class ColorRecommendation(BaseModel):
    hex_color: str = Field(..., pattern="^#[0-9a-fA-F]{6}$", description="Hex color code")
    preview_url: str = Field(..., description="URL of the preview image with this color")

class RecommendationResponse(BaseModel):
    image_id: str
    recommendations: List[ColorRecommendation]

class DecorationSuggestion(BaseModel):
    background: str = Field(..., description="Description of the current room background")
    good_points: List[str] = Field(..., description="List of positive aspects about the current decoration")
    bad_points: List[str] = Field(..., description="List of areas that need improvement")
    suggestions: List[str] = Field(..., description="List of professional decoration suggestions")

class DecorationRequest(BaseModel):
    image_id: str = Field(..., description="ID of the uploaded image to analyze")
    
    @validator('image_id')
    def validate_image_id(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid image ID format')
        return v

class DecorationResponse(BaseModel):
    image_id: str
    analysis: DecorationSuggestion