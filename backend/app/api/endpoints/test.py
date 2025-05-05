from fastapi import APIRouter, Response
from PIL import Image
import io

router = APIRouter()

@router.get("/test-image")
async def test_image():
    """
    Generate a simple test image to verify image handling
    """
    # Create a small test image
    img = Image.new('RGB', (100, 100), color='red')
    
    # Save it to a bytes buffer
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()
    
    return Response(content=img_byte_arr, media_type="image/png")

@router.get("/ping")
async def ping():
    """
    Simple endpoint to verify API is responding
    """
    return {"status": "ok", "message": "API is running"}