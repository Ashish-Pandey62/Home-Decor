from fastapi import APIRouter, HTTPException
from app.models.schemas import DecorationRequest, DecorationResponse, DecorationSuggestion
from app.services.decoration_service import decoration_service
from app.services.file_service import FileService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/analyze", response_model=DecorationResponse)
async def analyze_room(request: DecorationRequest):
    """
    Analyze a room image and provide professional decoration suggestions
    """
    try:
        # Get the path to the uploaded image
        image_path = FileService.get_file_path(request.image_id)
        if not image_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Image with id {request.image_id} not found"
            )
            
        # Get decoration suggestions from Gemini
        result = await decoration_service.get_decoration_suggestions(image_path)
        
        # Create response
        suggestion = DecorationSuggestion(
            background=result['background'],
            good_points=result['good_points'],
            bad_points=result['bad_points'],
            suggestions=result['suggestions']
        )
        
        return DecorationResponse(
            image_id=request.image_id,
            analysis=suggestion
        )
        
    except ImportError as e:
        logger.error(f"Dependency error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Missing required dependency. Please install google-generativeai package using: pip install google-generativeai"
        )
    except Exception as e:
        logger.error(f"Error analyzing room: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )