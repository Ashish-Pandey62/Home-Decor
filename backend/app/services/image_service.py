import numpy as np
import cv2
from pathlib import Path
from ..models.wall_detector import WallDetector
from ..models.schemas import WallMask
from ..core.exceptions import ImageProcessingError
from .file_service import FileService
from typing import List, Tuple, Dict
import base64

class ImageService:
    def __init__(self):
        """Initialize the image service with wall detector"""
        self.wall_detector = WallDetector()
        self._processing_cache: Dict[str, Dict] = {}

    async def process_upload(self, image_id: str, file_path: Path) -> Dict[str, List[WallMask]]:
        """Process an uploaded image to detect walls"""
        try:
            # Load and process image
            image = self.wall_detector.load_image(file_path)
            
            # Detect walls
            detection_result = self.wall_detector.detect_walls(image)
            
            # Convert masks to response format
            walls = []
            for idx, mask in enumerate(detection_result['masks']):
                wall_id = f"{image_id}_wall_{idx}"
                mask_obj = WallMask(
                    mask_id=wall_id,
                    coordinates=self._encode_mask_coordinates(mask['segmentation']),
                    area=mask['area'],
                    confidence=mask['score']
                )
                walls.append(mask_obj)
            
            # Cache the detection result for later use
            self._processing_cache[image_id] = {
                'image': image,
                'wall_mask': detection_result['wall_mask'],
                'walls': walls
            }
            
            # Save preview with detected walls highlighted
            preview_image = self._create_detection_preview(image, detection_result['wall_mask'])
            preview_path = FileService.save_processed_image(
                image_id, 
                cv2.imencode('.jpg', preview_image)[1].tobytes(),
                "_preview"
            )
            
            return {
                'walls': walls,
                'preview_url': FileService.get_file_url(preview_path)
            }
            
        except Exception as e:
            raise ImageProcessingError(f"Error processing image: {str(e)}")

    async def apply_wall_color(
        self, 
        image_id: str, 
        color_rgb: Tuple[int, int, int],
        wall_ids: List[str]
    ) -> Path:
        """Apply color to specified walls"""
        try:
            if image_id not in self._processing_cache:
                raise ImageProcessingError("Image not found in processing cache")
            
            cache = self._processing_cache[image_id]
            image = cache['image']
            wall_mask = cache['wall_mask']
            
            # Apply color
            colored_image = self.wall_detector.apply_color(image, wall_mask, color_rgb)
            
            # Save result
            result_path = FileService.save_processed_image(
                image_id,
                cv2.imencode('.jpg', cv2.cvtColor(colored_image, cv2.COLOR_RGB2BGR))[1].tobytes(),
                "_colored"
            )
            
            return result_path
            
        except Exception as e:
            raise ImageProcessingError(f"Error applying color: {str(e)}")

    @staticmethod
    def _encode_mask_coordinates(mask: np.ndarray) -> List[List[int]]:
        """Convert mask to list of coordinates for API response"""
        coords = np.where(mask)
        return [[int(x), int(y)] for x, y in zip(coords[0], coords[1])]

    @staticmethod
    def _create_detection_preview(image: np.ndarray, wall_mask: np.ndarray) -> np.ndarray:
        """Create a preview image with detected walls highlighted"""
        preview = image.copy()
        
        # Create semi-transparent overlay
        overlay = np.zeros_like(preview)
        overlay[wall_mask > 0] = [0, 255, 0]  # Green highlight
        
        # Blend images
        alpha = 0.3
        preview = cv2.addWeighted(overlay, alpha, preview, 1 - alpha, 0)
        
        return cv2.cvtColor(preview, cv2.COLOR_RGB2BGR)

    def cleanup_cache(self, image_id: str):
        """Remove cached data for an image"""
        if image_id in self._processing_cache:
            del self._processing_cache[image_id]