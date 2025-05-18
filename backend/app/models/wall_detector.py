import cv2
import numpy as np
import torch
import random
from pathlib import Path
import matplotlib.pyplot as plt
from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
from ..core.config import settings
from ..core.exceptions import ModelError, InvalidImageError

class WallRecoloringTool:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {self.device}")

        model_type = "vit_h"
        checkpoint = "sam_vit_h_4b8939.pth"

        self.sam = sam_model_registry[model_type](checkpoint=checkpoint)
        self.sam.to(device=self.device)

        self.mask_generator = SamAutomaticMaskGenerator(
            model=self.sam,
            points_per_side=32,
            pred_iou_thresh=0.9,
            stability_score_thresh=0.92,
            crop_n_layers=1,
            crop_n_points_downscale_factor=2,
            min_mask_region_area=100
        )

        self.predictor = SamPredictor(self.sam)

        self.selected_segments = []
        self.wall_mask = None

    def load_image(self, image_path):
        self.original_image = cv2.imread(image_path)
        if self.original_image is None:
            raise ValueError(f"Could not load image from {image_path}")
        self.original_image = cv2.cvtColor(self.original_image, cv2.COLOR_BGR2RGB)
        self.height, self.width = self.original_image.shape[:2]

        self.predictor.set_image(self.original_image)

        return self.original_image

    def generate_segments(self):
        self.segments = self.mask_generator.generate(self.original_image)
        print(f"Generated {len(self.segments)} segments")
        return self.segments

    def select_wall_segments(self):
        if not hasattr(self, 'segments'):
            self.generate_segments()

        self.selected_segments = []

        wall_mask = np.zeros((self.height, self.width), dtype=np.uint8)


        sorted_segments = sorted(self.segments, key=lambda x: x['area'], reverse=True)

        # Take the top 30% of segments by area as candidates
        num_candidates = max(1, int(len(sorted_segments) * 0.3))
        candidates = sorted_segments[:num_candidates]

        for segment in candidates:
            mask = segment['segmentation']

            # boundary bata in/out
            touches_boundary = (
                np.any(mask[0, :]) or
                np.any(mask[-1, :]) or
                np.any(mask[:, 0]) or
                np.any(mask[:, -1])
            )

            # Calculating solidity (area / convex hull area) as a measure of simplicity
            contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if len(contours) > 0:
                hull = cv2.convexHull(contours[0])
                hull_area = cv2.contourArea(hull)
                solidity = segment['area'] / hull_area if hull_area > 0 else 0
            else:
                solidity = 0

            # Check color - walls are typically light colored,haha
            segment_pixels = self.original_image[mask]
            avg_color = np.mean(segment_pixels, axis=0)
            is_light = np.mean(avg_color) > 150  # Threshold for "lightness"

            # Combine all criteria
            if touches_boundary and solidity > 0.7 and is_light:
                self.selected_segments.append(segment)
                wall_mask = np.logical_or(wall_mask, mask)

        # If no segments were selected, use fallback: just take the largest segment
        if len(self.selected_segments) == 0 and len(sorted_segments) > 0:
            self.selected_segments.append(sorted_segments[0])
            wall_mask = np.logical_or(wall_mask, sorted_segments[0]['segmentation'])

        self.wall_mask = wall_mask.astype(np.uint8)
        return self.wall_mask

    def detect_walls(self):
        return self.select_wall_segments()


    def apply_color(self, color_rgb, image=None, wall_mask=None):
        """Apply color to detected walls"""
        if image is not None:
            self.original_image = image
        
        if wall_mask is not None:
            self.wall_mask = wall_mask
        elif not hasattr(self, 'wall_mask') or self.wall_mask is None:
            self.detect_walls()

        result_image = self.original_image.copy()

        # Convert to HSV for better color manipulation
        hsv_image = cv2.cvtColor(self.original_image, cv2.COLOR_RGB2HSV)
        color_hsv = cv2.cvtColor(np.uint8([[color_rgb]]), cv2.COLOR_RGB2HSV)[0][0]

        wall_pixels = np.where(self.wall_mask == 1)

        # Replace hue and saturation while preserving some luminance
        hsv_image[wall_pixels[0], wall_pixels[1], 0] = color_hsv[0]
        hsv_image[wall_pixels[0], wall_pixels[1], 1] = color_hsv[1]
        luminance_scale = 0.7  # Blend original and new brightness

        hsv_image[wall_pixels[0], wall_pixels[1], 2] = np.clip(
            color_hsv[2] * (1-luminance_scale) + hsv_image[wall_pixels[0], wall_pixels[1], 2] * luminance_scale,
            0, 255
        ).astype(np.uint8)

        result_image = cv2.cvtColor(hsv_image, cv2.COLOR_HSV2RGB)

        # Blend at the edges of the mask for smoother transition
        mask_blurred = cv2.GaussianBlur(self.wall_mask.astype(np.float32), (21, 21), 0)
        mask_blurred = np.stack([mask_blurred] * 3, axis=2)

        result_image = (mask_blurred * result_image + (1 - mask_blurred) * self.original_image).astype(np.uint8)

        return result_image

    def apply_wallpaper(self, wallpaper_bytes: bytes) -> np.ndarray:
        """Apply wallpaper to detected walls"""
        try:
            # Decode wallpaper image
            wallpaper = cv2.imdecode(np.frombuffer(wallpaper_bytes, np.uint8), cv2.IMREAD_UNCHANGED)
            if wallpaper is None:
                raise InvalidImageError("Failed to decode wallpaper image")

            # Handle transparency
            if wallpaper.shape[2] == 4:
                wallpaper = cv2.cvtColor(wallpaper, cv2.COLOR_BGRA2RGBA)
            else:
                wallpaper = cv2.cvtColor(wallpaper, cv2.COLOR_BGR2RGB)
                alpha_channel = np.ones((wallpaper.shape[0], wallpaper.shape[1]), dtype=np.uint8) * 255
                wallpaper = np.dstack((wallpaper, alpha_channel))

            # Resize to match room dimensions
            wallpaper = cv2.resize(wallpaper, (self.width, self.height), interpolation=cv2.INTER_LINEAR)

            # Prepare components
            wallpaper_rgb = wallpaper[..., :3]
            wallpaper_alpha = wallpaper[..., 3] / 255.0  # Normalize alpha

            # Verify wall mask
            if not hasattr(self, 'wall_mask') or self.wall_mask is None:
                self.detect_walls()

            # Create smooth mask
            mask_blurred = cv2.GaussianBlur(self.wall_mask.astype(np.float32), (15, 15), 0)
            combined_alpha = mask_blurred * wallpaper_alpha

            # Blend images
            result = self.original_image.copy().astype(np.float32)
            wallpaper_rgb = wallpaper_rgb.astype(np.float32)

            for c in range(3):
                result[..., c] = result[..., c] * (1 - combined_alpha) + wallpaper_rgb[..., c] * combined_alpha

            return np.clip(result, 0, 255).astype(np.uint8)

        except Exception as e:
            raise InvalidImageError(f"Error applying wallpaper: {str(e)}")

    def generate_recommendations(self, num_colors: int = 4) -> list:
        """
        Generate recommended color schemes based on current wall detection
        Returns list of tuples (hex_color, preview_image)
        """
        if not hasattr(self, 'wall_mask') or self.wall_mask is None:
            self.detect_walls()

        recommendations = []
        for _ in range(num_colors):
            # Generate pleasant colors in HSV space
            hue = random.randint(0, 360)
            saturation = random.randint(30, 70)
            value = random.randint(70, 95)
            
            # Convert to RGB
            hsv_color = np.uint8([[[hue, saturation, value]]])
            rgb_color = cv2.cvtColor(hsv_color, cv2.COLOR_HSV2RGB)[0][0]
            
            # Apply color and store result
            colored_image = self.apply_color(tuple(rgb_color))
            hex_color = '#%02x%02x%02x' % tuple(rgb_color)
            recommendations.append((hex_color, colored_image))
        
        return recommendations
    
    def display_results(self, original, mask, result):
        """Display original image, mask, and result side by side"""
        plt.figure(figsize=(18, 6))
        plt.subplot(1, 3, 1)
        plt.imshow(original)
        plt.title('Original Image')
        plt.axis('off')

        plt.subplot(1, 3, 2)
        plt.imshow(mask, cmap='gray')
        plt.title('Wall Mask')
        plt.axis('off')

        plt.subplot(1, 3, 3)
        plt.imshow(result)
        plt.title('Recolored Walls')
        plt.axis('off')

        plt.tight_layout()
        plt.show()

    def save_result(self, result_image, output_path):
        """Save the result image to a file"""
        result_rgb = cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR)
        cv2.imwrite(output_path, result_rgb)
        print(f"Result saved to {output_path}")
        
    @staticmethod
    def validate_color(color_rgb: tuple) -> bool:
        """Validate RGB color values"""
        if not isinstance(color_rgb, (tuple, list)) or len(color_rgb) != 3:
            return False
        return all(isinstance(c, int) and 0 <= c <= 255 for c in color_rgb)