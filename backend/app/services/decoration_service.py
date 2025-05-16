from pathlib import Path
from app.core.config import settings
import logging
import importlib.util
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class DecorationService:
    def __init__(self):
        # Check if google.generativeai is available
        if importlib.util.find_spec("google.generativeai") is None:
            logger.error("google-generativeai package is not installed. Please install it using: pip install google-generativeai")
            raise ImportError(
                "Required package 'google-generativeai' is not installed. "
                "Please install it using: pip install google-generativeai"
            )
        
        # Import and configure Gemini
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.genai = genai
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
    async def get_decoration_suggestions(self, image_path: Path) -> dict:
        """
        Analyze room image using Gemini Vision API and get decoration suggestions
        """
        try:
            # Debug logging for image loading
            logger.info(f"Attempting to load image from path: {image_path}")
            logger.info(f"Available genai attributes: {dir(self.genai)}")
            
            # Prepare image for Gemini
            from PIL import Image
            image = Image.open(str(image_path))
            
            # Craft prompt for professional room decoration analysis
            prompt = """
            As a professional interior decorator, analyze this room image and provide detailed feedback:
            1. Describe the current background/setup
            2. List the good points about current decoration
            3. List areas that need improvement
            4. Provide specific suggestions for improving the room's aesthetics
            
            Format your response in JSON with these keys:
            {
                "background": "description",
                "good_points": ["point1", "point2"],
                "bad_points": ["point1", "point2"],
                "suggestions": ["suggestion1", "suggestion2"]
            }
            """

            # Convert PIL Image to bytes for Gemini
            import io
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format=image.format or 'JPEG')
            img_byte_arr = img_byte_arr.getvalue()

            # Generate response from Gemini
            response = self.model.generate_content([prompt, {"mime_type": "image/jpeg", "data": img_byte_arr}])
            
            # Extract JSON from response
            try:
                # Clean the response text to extract only the JSON part
                response_text = response.text
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_start == -1 or json_end == 0:
                    raise ValueError("No JSON found in response")
                
                import json
                result = json.loads(response_text[json_start:json_end])
                
                # Ensure all required keys are present
                required_keys = ['background', 'good_points', 'bad_points', 'suggestions']
                if not all(key in result for key in required_keys):
                    raise ValueError("Missing required keys in response")
                
                return result
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini response as JSON: {e}")
                raise ValueError("Invalid response format from Gemini API")
                
        except Exception as e:
            logger.error(f"Error in decoration analysis: {e}")
            raise Exception(f"Failed to analyze room: {str(e)}")

decoration_service = DecorationService()