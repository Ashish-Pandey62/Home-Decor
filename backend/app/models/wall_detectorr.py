import cv2
import numpy as np
import torch
from pathlib import Path
from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
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
            
            # Initialize mask generator like in your Colab version
            self.mask_generator = SamAutomaticMaskGenerator(
                model=self.sam,
                points_per_side=32,
                pred_iou_thresh=0.9,
                stability_score_thresh=0.92,
                crop_n_layers=1,
                crop_n_points_downscale_factor=2,
                min_mask_region_area=100
            )
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
            # Set image for predictor (will be used in apply_color)
            self.predictor.set_image(image)
            
            # Get image dimensions
            height, width = image.shape[:2]
            
            # Generate automatic masks using the approach from your Colab code
            segments = self.mask_generator.generate(image)
            print(f"Generated {len(segments)} segments")
            
            selected_segments = []
            wall_mask = np.zeros((height, width), dtype=np.uint8)
            
            # Use your proven wall detection logic from Colab
            sorted_segments = sorted(segments, key=lambda x: x['area'], reverse=True)
            
            # Take the top 30% of segments by area as candidates
            num_candidates = max(1, int(len(sorted_segments) * 0.3))
            candidates = sorted_segments[:num_candidates]
            
            for segment in candidates:
                mask = segment['segmentation']
                
                # Check if mask touches boundary
                touches_boundary = (
                    np.any(mask[0, :]) or
                    np.any(mask[-1, :]) or
                    np.any(mask[:, 0]) or
                    np.any(mask[:, -1])
                )
                
                # Calculate solidity (area / convex hull area) as a measure of simplicity
                contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if len(contours) > 0:
                    hull = cv2.convexHull(contours[0])
                    hull_area = cv2.contourArea(hull)
                    solidity = segment['area'] / hull_area if hull_area > 0 else 0
                else:
                    solidity = 0
                
                # Check color - walls are typically light colored
                segment_pixels = image[mask]
                avg_color = np.mean(segment_pixels, axis=0)
                is_light = np.mean(avg_color) > 150  # Threshold for "lightness"
                
                # Combine all criteria
                if touches_boundary and solidity > 0.7 and is_light:
                    selected_segments.append(segment)
                    wall_mask = np.logical_or(wall_mask, mask)
            
            # If no segments were selected, use fallback: just take the largest segment
            if len(selected_segments) == 0 and len(sorted_segments) > 0:
                selected_segments.append(sorted_segments[0])
                wall_mask = np.logical_or(wall_mask, sorted_segments[0]['segmentation'])
            
            # Convert to uint8 for storage/transmission
            wall_mask = wall_mask.astype(np.uint8) * 255
            
            return {
                'wall_mask': wall_mask,
                'masks': selected_segments
            }
            
        except Exception as e:
            raise ModelError(f"Error detecting walls: {str(e)}")

    def apply_color(self, image: np.ndarray, wall_mask: np.ndarray, color_rgb: tuple) -> np.ndarray:
        """Apply color to detected walls"""
        try:
            # Convert wall mask to boolean (accounting for potential 0-255 range)
            if wall_mask.max() > 1:
                wall_mask = wall_mask > 0
            
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