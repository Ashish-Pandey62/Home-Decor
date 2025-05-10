import cv2
import numpy as np
import torch
import random
from pathlib import Path
import matplotlib.pyplot as plt
from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
from ..core.config import settings
from ..core.exceptions import ModelError, InvalidImageError

class WallDetector:
    def __init__(self):
        """Initialize the wall detector with SAM model"""
        try:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            print(f"Using device: {self.device}")
            
            model_type = settings.MODEL_TYPE
            checkpoint = str(settings.MODEL_PATH)
            
            self.sam = sam_model_registry[model_type](checkpoint=checkpoint)
            self.sam.to(device=self.device)
            
            self.mask_generator = SamAutomaticMaskGenerator(
                model=self.sam,
                points_per_side=64,
                pred_iou_thresh=0.86,
                stability_score_thresh=0.9,
                crop_n_layers=1,
                crop_n_points_downscale_factor=2,
                min_mask_region_area=500
            )
            self.predictor = SamPredictor(self.sam)
            self.selected_segments = []
            self.wall_mask = None
            self.original_image = None
        except Exception as e:
            raise ModelError(f"Failed to initialize SAM model: {str(e)}")

    def load_image(self, image_path: Path) -> np.ndarray:
        """Load and prepare image for processing"""
        try:
            self.original_image = cv2.imread(str(image_path))
            if self.original_image is None:
                raise InvalidImageError(f"Could not load image from {image_path}")
            
            self.original_image = cv2.cvtColor(self.original_image, cv2.COLOR_BGR2RGB)
            self.height, self.width = self.original_image.shape[:2]
            self.predictor.set_image(self.original_image)
            return self.original_image
        except Exception as e:
            raise InvalidImageError(f"Error loading image: {str(e)}")

    def generate_segments(self):
        """Generate segments using SAM"""
        self.segments = self.mask_generator.generate(self.original_image)
        print(f"Generated {len(self.segments)} segments")
        return self.segments

    def detect_walls(self, image=None) -> np.ndarray:
        """Detect walls in the image using SAM with improved algorithm"""
        if image is not None:
            self.original_image = image
            self.height, self.width = self.original_image.shape[:2]
            self.predictor.set_image(self.original_image)
        
        if not hasattr(self, 'segments'):
            self.generate_segments()

        self.wall_mask = np.zeros((self.height, self.width), dtype=np.uint8)
        self.selected_segments = []
        selected_segment_ids = set()

        all_colors = []
        for idx, segment in enumerate(self.segments):
            mask = segment['segmentation']
            segment_pixels = self.original_image[mask]
            if len(segment_pixels) > 0:
                avg_color = np.mean(segment_pixels, axis=0)
                all_colors.append((avg_color, segment['area'], idx))

        all_colors = sorted(all_colors, key=lambda x: x[1], reverse=True)
        dominant_colors = all_colors[:min(5, len(all_colors))]

        sorted_segments = [(idx, segment) for idx, segment in enumerate(self.segments)]
        sorted_segments.sort(key=lambda x: x[1]['area'], reverse=True)

        for idx, segment in sorted_segments:
            mask = segment['segmentation']
            segment_pixels = self.original_image[mask]

            if len(segment_pixels) == 0:
                continue

            avg_color = np.mean(segment_pixels, axis=0)
            std_color = np.std(segment_pixels, axis=0)

            touches_boundary = (
                np.any(mask[0, :]) or
                np.any(mask[-1, :]) or
                np.any(mask[:, 0]) or
                np.any(mask[:, -1])
            )

            contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if len(contours) > 0:
                hull = cv2.convexHull(contours[0])
                hull_area = cv2.contourArea(hull)
                solidity = segment['area'] / hull_area if hull_area > 0 else 0

                perimeter = cv2.arcLength(contours[0], True)
                perimeter_area_ratio = perimeter / segment['area'] if segment['area'] > 0 else float('inf')
            else:
                solidity = 0
                perimeter_area_ratio = float('inf')

            color_homogeneity = np.mean(std_color)

            area_percentage = segment['area'] / (self.height * self.width)

            is_wall = (
                (touches_boundary) and
                (solidity > 0.75) and
                (color_homogeneity < 30) and
                (perimeter_area_ratio < 0.1) and
                (area_percentage > 0.05)
            )

            if is_wall:
                self.wall_mask = np.logical_or(self.wall_mask, mask)
                self.selected_segments.append(segment)
                selected_segment_ids.add(idx)

        # Additional color-based refinement
        if len(self.selected_segments) > 0:
            wall_pixels = self.original_image[self.wall_mask == 1]
            if len(wall_pixels) > 0:
                wall_avg_color = np.mean(wall_pixels, axis=0)

                for idx, segment in sorted_segments:
                    if idx in selected_segment_ids:
                        continue

                    mask = segment['segmentation']
                    segment_pixels = self.original_image[mask]

                    if len(segment_pixels) == 0:
                        continue

                    avg_color = np.mean(segment_pixels, axis=0)
                    color_distance = np.linalg.norm(avg_color - wall_avg_color)

                    if color_distance < 35 and segment['area'] > 1000:
                        self.wall_mask = np.logical_or(self.wall_mask, mask)
                        self.selected_segments.append(segment)
                        selected_segment_ids.add(idx)

        # Fallback for when no walls are detected
        if np.sum(self.wall_mask) < 0.1 * (self.height * self.width):
            for idx, segment in sorted_segments[:10]:
                if idx in selected_segment_ids:
                    continue

                mask = segment['segmentation']
                segment_pixels = self.original_image[mask]

                if len(segment_pixels) == 0:
                    continue

                avg_color = np.mean(segment_pixels, axis=0)
                
                # Check if it might be a green screen
                is_green = avg_color[1] > avg_color[0] and avg_color[1] > avg_color[2]

                if is_green and segment['area'] > 0.05 * (self.height * self.width):
                    self.wall_mask = np.logical_or(self.wall_mask, mask)
                    self.selected_segments.append(segment)
                    selected_segment_ids.add(idx)

        # Smoothing the mask
        kernel = np.ones((15, 15), np.uint8)
        self.wall_mask = cv2.morphologyEx(self.wall_mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)

        return self.wall_mask

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