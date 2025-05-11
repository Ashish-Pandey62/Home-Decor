import numpy as np
import cv2
from pathlib import Path
from typing import List, Tuple, Dict
import base64
import pickle
import os

from ..models.wall_detector import WallDetector
from ..models.schemas import WallMask
from ..core.exceptions import ImageProcessingError
from ..core.config import settings, logger
from .file_service import FileService

class ImageService:
    def __init__(self):
        """Initialize the image service with wall detector"""
        self.wall_detector = WallDetector()
        # Ensure required directories exist
        settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        settings.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        self.cache_dir = settings.PROCESSED_DIR / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Initialized ImageService with cache directory: {str(self.cache_dir.absolute())}")
        
        # Verify cache directory is writable
        try:
            test_file = self.cache_dir / "test_write"
            test_file.touch()
            test_file.unlink()
            logger.debug("Cache directory is writable")
        except Exception as e:
            logger.error(f"Cache directory is not writable: {str(e)}")
            raise ImageProcessingError(f"Cache directory is not writable: {str(e)}")

    def _get_cache_path(self, image_id: str) -> Path:
        """Get the cache file path for an image"""
        cache_path = self.cache_dir / f"{image_id}_cache.pkl"
        logger.debug(f"Cache path for {image_id}: {str(cache_path.absolute())}")
        return cache_path

    def _save_to_cache(self, image_id: str, data: Dict):
        """Save data to disk cache"""
        try:
            cache_path = self._get_cache_path(image_id)
            logger.debug(f"Saving cache for {image_id} to {str(cache_path.absolute())}")
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(str(cache_path.absolute()), 'wb') as f:
                pickle.dump(data, f)
            logger.info(f"Successfully saved cache for {image_id}")
        except Exception as e:
            logger.error(f"Failed to save cache for {image_id}: {str(e)}")
            raise ImageProcessingError(f"Failed to save cache: {str(e)}")

    def _load_from_cache(self, image_id: str) -> Dict:
        """Load data from disk cache"""
        try:
            cache_path = self._get_cache_path(image_id)
            logger.debug(f"Loading cache for {image_id} from {str(cache_path.absolute())}")
            if not cache_path.exists():
                logger.error(f"Cache file not found for {image_id}")
                raise ImageProcessingError("Image not found in processing cache")
            with open(str(cache_path.absolute()), 'rb') as f:
                data = pickle.load(f)
            logger.info(f"Successfully loaded cache for {image_id}")
            return data
        except Exception as e:
            logger.error(f"Failed to load cache for {image_id}: {str(e)}")
            raise ImageProcessingError(f"Failed to load cache: {str(e)}")

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
            logger.debug(f"Preparing cache data for image {image_id}")
            try:
                cache_data = {
                    'image': image,
                    'wall_mask': detection_result['wall_mask'],
                    'walls': walls
                }
                logger.debug("Cache data prepared successfully")
                self._save_to_cache(image_id, cache_data)
            except Exception as e:
                logger.error(f"Failed to prepare cache data: {str(e)}")
                raise ImageProcessingError(f"Failed to prepare cache data: {str(e)}")
            
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
            cache = self._load_from_cache(image_id)
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
        cache_path = self._get_cache_path(image_id)
        try:
            if cache_path.exists():
                os.remove(cache_path)
        except Exception as e:
            logger.error(f"Failed to cleanup cache for {image_id}: {str(e)}")