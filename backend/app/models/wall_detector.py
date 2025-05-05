import cv2
import numpy as np
import torch
from pathlib import Path
from segment_anything import sam_model_registry, SamPredictor
from ..core.config import settings
from ..core.exceptions import ModelError, InvalidImageError

class WallDetector:
    def __init__(self):
        """Initialize the wall detector with SAM model"""
        try:
            self.device = torch.device(settings.DEVICE)
            self.sam = sam_model_registry[settings.MODEL_TYPE](checkpoint=str(settings.MODEL_PATH))
            self.sam.to(device=self.device)
            self.predictor = SamPredictor(self.sam)
        except Exception as e:
            raise ModelError(f"Failed to initialize SAM model: {str(e)}")

    def load_image(self, image_path: Path) -> np.ndarray:
        """Load and prepare image for processing"""
        try:
            image = cv2.imread(str(image_path))
            if image is None:
                raise InvalidImageError(f"Could not load image from {image_path}")
            
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            return image
        except Exception as e:
            raise InvalidImageError(f"Error loading image: {str(e)}")

    def detect_walls(self, image: np.ndarray) -> dict:
        """Detect walls in the image using SAM"""
        try:
            # Set image for predictor
            self.predictor.set_image(image)
            
            # Get image dimensions
            height, width = image.shape[:2]
            
            # Generate automatic mask
            masks = []
            wall_mask = np.zeros((height, width), dtype=np.uint8)
            
            # Process center points of image to detect walls
            center_points = [
                (width // 2, height // 2),
                (width // 4, height // 2),
                (3 * width // 4, height // 2),
                (width // 2, height // 4),
                (width // 2, 3 * height // 4)
            ]
            
            for point in center_points:
                input_point = np.array([[point[0], point[1]]])
                input_label = np.array([1])
                
                masks_batch, scores, _ = self.predictor.predict(
                    point_coords=input_point,
                    point_labels=input_label,
                    multimask_output=True
                )
                
                # Take the highest scoring mask
                if len(scores) > 0:
                    best_mask = masks_batch[scores.argmax()]
                    wall_mask = np.logical_or(wall_mask, best_mask)
                    masks.append({
                        'segmentation': best_mask.tolist(),
                        'score': float(scores.max()),
                        'area': int(best_mask.sum())
                    })

            # Convert to uint8 for storage/transmission
            wall_mask = wall_mask.astype(np.uint8) * 255
            
            return {
                'wall_mask': wall_mask,
                'masks': masks
            }
            
        except Exception as e:
            raise ModelError(f"Error detecting walls: {str(e)}")

    def apply_color(self, image: np.ndarray, wall_mask: np.ndarray, color_rgb: tuple) -> np.ndarray:
        """Apply color to detected walls"""
        try:
            # Convert wall mask to boolean
            wall_mask = wall_mask.astype(bool)
            
            # Convert image to LAB color space
            lab_image = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
            
            # Convert target color to LAB
            color_rgb_arr = np.uint8([[color_rgb]])
            color_lab = cv2.cvtColor(color_rgb_arr, cv2.COLOR_RGB2LAB)[0][0]
            
            # Get wall pixels
            wall_pixels = np.where(wall_mask)
            
            # Apply color while preserving luminance
            lab_image[wall_pixels[0], wall_pixels[1], 0] = lab_image[wall_pixels[0], wall_pixels[1], 0]
            lab_image[wall_pixels[0], wall_pixels[1], 1] = color_lab[1]
            lab_image[wall_pixels[0], wall_pixels[1], 2] = color_lab[2]
            
            # Convert back to RGB
            result_image = cv2.cvtColor(lab_image, cv2.COLOR_LAB2RGB)
            
            return result_image
            
        except Exception as e:
            raise ModelError(f"Error applying color: {str(e)}")

    @staticmethod
    def validate_color(color_rgb: tuple) -> bool:
        """Validate RGB color values"""
        if not isinstance(color_rgb, (tuple, list)) or len(color_rgb) != 3:
            return False
        return all(isinstance(c, int) and 0 <= c <= 255 for c in color_rgb)