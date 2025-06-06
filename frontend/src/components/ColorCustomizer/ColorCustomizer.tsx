import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { MdUndo, MdRedo } from 'react-icons/md';
import * as api from '../../services/api';
import DecorationAnalysis from '../DecorationAnalysis/DecorationAnalysis';

// Color conversion utilities
function rgbToHsv(r: number, g: number, b: number): { h: number, s: number, v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    if (max === r) {
      h = 60 * ((g - b) / diff + (g < b ? 6 : 0));
    } else if (max === g) {
      h = 60 * ((b - r) / diff + 2);
    } else if (max === b) {
      h = 60 * ((r - g) / diff + 4);
    }
  }

  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number, g: number, b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h >= 60 && h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h >= 120 && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h >= 180 && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h >= 240 && h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

const CustomizerContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  align-items: center;
`;

const CanvasContainer = styled.div`
  position: relative;
  max-width: 800px;
  width: 100%;
  height: auto;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: auto;
  cursor: pointer;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  color: #007bff;
`;

const ToolbarContainer = styled.div`
  display: flex;
  gap: 10px;
  padding: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const ToolButton = styled.button<{ disabled?: boolean }>`
  padding: 8px;
  border: none;
  border-radius: 4px;
  background: ${props => props.disabled ? '#e9ecef' : '#007bff'};
  color: white;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;

  &:hover {
    background: ${props => props.disabled ? '#e9ecef' : '#0056b3'};
  }
`;

const SegmentOverlay = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: center;
  pointer-events: none;
  & > g {
    pointer-events: auto;
  }
`;

interface ColorCustomizerProps {
  image: HTMLImageElement;
  imageId: string;
  currentColor: string | null;
  onWallsDetected?: () => void;
}

interface WallSegment {
  id: string;
  pathData: string;
  area: number;
  confidence: number;
  dimensions: [number, number];
  pattern?: string; // URL of the pattern image
}

interface HistoryEntry {
  image_id: string;
  imageUrl: string;
  segments: WallSegment[];
}


// Helper function to sort coordinates to form a proper boundary
// Process coordinates to form proper wall boundaries
const processWallBoundary = (coordinates: [number, number][]): [number, number][] => {
  if (coordinates.length < 3) return coordinates;

  // Group coordinates by rows to detect boundary points
  const pointsByRow = new Map<number, Set<number>>();
  coordinates.forEach(([y, x]) => {
    if (!pointsByRow.has(y)) {
      pointsByRow.set(y, new Set());
    }
    pointsByRow.get(y)!.add(x);
  });

  // Extract boundary points by finding leftmost and rightmost points in each row
  const boundaryPoints: [number, number][] = [];
  pointsByRow.forEach((xValues, y) => {
    const sortedX = Array.from(xValues).sort((a, b) => a - b);
    if (sortedX.length > 0) {
      // Add leftmost and rightmost points
      boundaryPoints.push([y, sortedX[0]]);
      if (sortedX.length > 1) {
        boundaryPoints.push([y, sortedX[sortedX.length - 1]]);
      }
    }
  });

  // Sort points to form a continuous boundary
  const sortedPoints = boundaryPoints.sort((a, b) => {
    if (a[0] === b[0]) {
      return a[1] - b[1]; // Sort by x if y is same
    }
    return a[0] - b[0]; // Sort by y
  });

  // Add top points first, then bottom points in reverse
  const midPoint = Math.floor(sortedPoints.length / 2);
  const result: [number, number][] = [
    ...sortedPoints.slice(0, midPoint),
    ...sortedPoints.slice(midPoint).reverse()
  ];

  return result;
};

// Function to create a pattern from an image URL
const ColorCustomizer: React.FC<ColorCustomizerProps> = ({ image, imageId, currentColor, onWallsDetected }) => {
  // Generate a consistent color for each wall segment
  const getWallColor = (segmentId: string): string => {
    // Use segmentId to generate a consistent hue
    const hash = segmentId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousScaleRef = useRef({ x: 1, y: 1 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<WallSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [wallpaperFile, setWallpaperFile] = useState<File | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [decorationAnalysis, setDecorationAnalysis] = useState<api.DecorationAnalysisResponse | null>(null);

  // Debug logging for state changes
  // Debug logging for scaling and dimensions
  useEffect(() => {
    logAction('Overlay scaling debug', {
      canvasRef: {
        current: !!canvasRef.current,
        clientWidth: canvasRef.current?.clientWidth,
        clientHeight: canvasRef.current?.clientHeight
      },
      image: {
        width: image?.width,
        height: image?.height
      },
      scale,
      computedScale: canvasRef.current ? {
        x: canvasRef.current.clientWidth / (image?.width || 1),
        y: canvasRef.current.clientHeight / (image?.height || 1)
      } : null
    });
  }, [image, scale, canvasRef.current]);
  useEffect(() => {
    logAction('State Update', {
      wallpaperUrl,
      selectedSegment,
      isProcessing
    });
  }, [wallpaperUrl, selectedSegment, isProcessing]);


































  const logAction = (action: string, details?: any) => {
    console.log(`🎨 ColorCustomizer - ${action}`, details || '');
  };

  const logError = (action: string, error: any) => {
    console.error(`🚫 ColorCustomizer - ${action} Failed:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error,
      stack: error instanceof Error ? error.stack : undefined
    });
  };

  // Update scale based on canvas dimensions
  const updateScale = React.useCallback(() => {
    if (!canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Only update if dimensions have changed
    const newScaleX = image.width / displayWidth;
    const newScaleY = image.height / displayHeight;

    const prevScale = previousScaleRef.current;
    if (newScaleX !== prevScale.x || newScaleY !== prevScale.y) {
      previousScaleRef.current = { x: newScaleX, y: newScaleY };
      setScale({ x: newScaleX, y: newScaleY });
    }
  }, [image]);

  // Update scale whenever canvas size changes
  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [image, updateScale]);

  useEffect(() => {
    let mounted = true;
    const initializeImage = async () => {
      // Skip if missing data
      if (!image || !image.complete || !imageId) {
        logAction('Skipping initialization - missing data', {
          hasImage: !!image,
          imageComplete: image?.complete,
          hasImageId: !!imageId
        });
        return;
      }

      logAction('Initializing image', {
        width: image.width,
        height: image.height
      });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas dimensions to match image
      canvas.width = image.width;
      canvas.height = image.height;

      // Draw initial image with proper dimensions
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      logAction('Initial image drawn', {
        canvasDimensions: { width: canvas.width, height: canvas.height },
        imageDimensions: { width: image.width, height: image.height }
      });

      try {
        setIsProcessing(true);

        // Check if we have valid input
        logAction('Validating inputs', {
          hasImageId: !!imageId,
          imageWidth: image?.width,
          imageHeight: image?.height
        });

        if (!imageId) {
          throw new Error('No image ID provided');
        }

        // Attempt API call with error boundary
        logAction('Detecting walls', { image_id: imageId });
        let response;
        try {
          response = await api.detectWalls(imageId);
        } catch (apiError) {
          logError('API call failed', apiError);
          throw new Error(
            apiError instanceof Error
              ? `API call failed: ${apiError.message}`
              : 'API call failed with unknown error'
          );
        }

        // Log detailed API response
        logAction('Raw API response', {
          apiUrl: api.API_BASE_URL,
          hasResponse: !!response,
          responseKeys: response ? Object.keys(response) : [],
          mask: response?.mask?.substring(0, 100) + '...',
          image_id: response?.image_id,
          preview_url: response?.preview_url
        });

        // Validate API response
        if (!response) {
          throw new Error('API response is empty');
        }

        if (!response.mask) {
          throw new Error('API response missing mask data');
        }

        // Parse SVG mask to extract path data
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(response.mask, 'image/svg+xml');
        const paths = svgDoc.querySelectorAll('path');

        if (paths.length === 0) {
          throw new Error('No wall segments found in SVG mask');
        }

        // Convert SVG paths to wall segments
        const wallSegments = Array.from(paths).map((path, index) => {
          const pathData = path.getAttribute('d') || '';
          const dimensions = [0, 0] as [number, number]; // We don't need exact dimensions for SVG paths

          return {
            id: `wall-${index}`,
            pathData,
            area: 0, // We don't have area data anymore
            confidence: 1, // We don't have confidence data anymore
            dimensions
          };
        });

        logAction('Processed SVG mask', {
          totalPaths: paths.length,
          firstPath: wallSegments[0]?.pathData.substring(0, 50) + '...'
        });

        try {
          // Analyze decoration after wall detection
          logAction('Analyzing decoration', { image_id: imageId });
          const analysisResult = await api.analyzeDecoration(imageId);
          setDecorationAnalysis(analysisResult);
          logAction('Decoration analysis complete', analysisResult);
        } catch (analysisError) {
          logError('Decoration analysis failed', analysisError);
          console.warn('Decoration analysis failed but continuing with wall detection', analysisError);
        }

        // Create initial history entry
        const initialEntry = {
          image_id: response.image_id,
          imageUrl: response.preview_url,
          segments: wallSegments
        };

        setSegments(wallSegments);
        setHistory([initialEntry]);
        setHistoryIndex(0);

        // Notify parent that walls have been detected
        onWallsDetected?.();

        logAction('History initialized', {
          entryCount: 1,
          wallCount: wallSegments.length,
          image_id: initialEntry.image_id
        });
      } catch (error) {
        logError('Image processing', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logError('Image initialization', {
          error_type: error?.constructor?.name,
          error_message: errorMessage,
          error,
          canvas: {
            width: canvas.width,
            height: canvas.height,
            context: ctx ? 'available' : 'missing'
          },
          image: {
            width: image.width,
            height: image.height,
            src: image.src
          }
        });
        alert(`Failed to process image: ${errorMessage}\n\nPlease check the browser console for more details.`);
      } finally {
        setIsProcessing(false);
      }
    };

    if (!isProcessing) {
      initializeImage();
    }

    // Add keyboard event listeners for preview functionality
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isShowingOriginal && !isProcessing) {
        e.preventDefault();
        setIsShowingOriginal(true);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isShowingOriginal && !isProcessing) {
        e.preventDefault();
        setIsShowingOriginal(false);
        const canvas = canvasRef.current;
        if (canvas && historyIndex >= 0) {
          const ctx = canvas.getContext('2d');
          const currentState = history[historyIndex];
          if (ctx && currentState) {
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = currentState.imageUrl;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      mounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      logAction('Cleaning up image initialization effect');
    };
  }, [image, imageId]); // Only depend on image and imageId

  // Auto-apply color when segment or color changes
  useEffect(() => {
    if (!selectedSegment || isProcessing || !canvasRef.current || !image) return;

    const applyColor = async () => {
      setIsProcessing(true);
      try {
        await handleSegmentColor(selectedSegment);
      } finally {
        setIsProcessing(false);
      }
    };

    applyColor();
  }, [selectedSegment, currentColor]);

  const handleSegmentClick = async (segmentId: string): Promise<void> => {
    if (isProcessing || !canvasRef.current || !image) return;

    // If segment is already selected, deselect it and remove color
    if (selectedSegment === segmentId) {
      setSelectedSegment(null);
      await handleSegmentColor(segmentId);
    } else {
      // Select the new segment but keep its current state
      setSelectedSegment(segmentId);
      if (currentColor) {
        await handleSegmentColor(segmentId);
      }
    }
  };

  const removeAllColorOverlays = async (): Promise<void> => {
    if (isProcessing || !canvasRef.current || !image) return;

    setIsProcessing(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw original image as base
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Reset color selection
      setSelectedSegment(null);

      // Update history
      const finalImageUrl = canvas.toDataURL();
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({
        image_id: imageId,
        imageUrl: finalImageUrl,
        segments
      });
      setHistory(newHistory);
      setHistoryIndex(prev => prev + 1);

    } catch (error) {
      logError('Remove color overlays', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSegmentColor = async (segmentId: string): Promise<void> => {
    if (isProcessing || !canvasRef.current || !image) {
      logAction('Color application ignored', {
        isProcessing,
        hasCanvas: !!canvasRef.current,
        hasImage: !!image
      });
      return;
    }

    logAction('Starting segment click handler', {
      segmentId,
      hasWallpaper: !!wallpaperUrl,
      selectedSegment,
      currentColor
    });

    // If segment is already selected and clicked again, remove color
    const isRemovingColor = selectedSegment === segmentId;


    const clickedSegment = segments.find(segment => segment.id === segmentId);
    if (!clickedSegment) return;

    try {
      logAction('Processing color application', {
        segmentId,
        currentColor,
        hasWallpaper: !!wallpaperUrl,
        historyIndex,
        historyLength: history.length
      });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      logAction('Segment selected', {
        segmentId: clickedSegment.id,
        color: currentColor,
        hasWallpaper: !!wallpaperUrl,
        area: clickedSegment.area,
        confidence: clickedSegment.confidence
      });


      // Setup for drawing
      ctx.save();

      // Always start with a fresh copy of the original image
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Get original image data and create a working copy
      const { imageData: originalImageData, workingImageData } = (() => {
        const origData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const workData = ctx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < origData.data.length; i++) {
          workData.data[i] = origData.data[i];
        }
        return { imageData: origData, workingImageData: workData };
      })();

      // Create path from SVG data
      const path = new Path2D(clickedSegment.pathData);

      // Scale the path to match canvas dimensions
      const scaleX = canvas.width / image.width;
      const scaleY = canvas.height / image.height;
      ctx.scale(scaleX, scaleY);

      // We're already using originalImageData and workingImageData from above

      // Create a temporary canvas for the mask
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error('Failed to get mask context');

      // Draw and blur the mask
      // Create base mask
      maskCtx.save();
      maskCtx.scale(scaleX, scaleY);
      maskCtx.fillStyle = 'white';
      maskCtx.fill(path, 'evenodd');
      maskCtx.restore();

      // Apply Gaussian blur for smooth edges
      for (let i = 0; i < 3; i++) {
        maskCtx.filter = 'blur(2px)';
        maskCtx.drawImage(maskCanvas, 0, 0);
      }
      maskCtx.filter = 'none';

      // Only get mask data since we already have image data
      const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

      // Process color changes
      if (currentColor && !isRemovingColor) {
        // Parse color
        const colorMatch = currentColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (!colorMatch) throw new Error('Invalid color format');

        const r = parseInt(colorMatch[1], 16);
        const g = parseInt(colorMatch[2], 16);
        const b = parseInt(colorMatch[3], 16);

        // Convert target color to HSV once
        const targetHsv = rgbToHsv(r, g, b);
        const targetV = targetHsv.v;
        const targetS = Math.min(0.7, targetHsv.s); // Cap maximum saturation

        // Process each pixel
        for (let i = 0; i < workingImageData.data.length; i += 4) {
          const maskAlpha = maskData.data[i + 3] / 255;
          if (maskAlpha > 0) {
            // Get original pixel values
            const origR = originalImageData.data[i];
            const origG = originalImageData.data[i + 1];
            const origB = originalImageData.data[i + 2];

            // Convert to HSV
            const origHsv = rgbToHsv(origR, origG, origB);

            // Blend in HSV space with controlled values
            const blendedHsv = {
              h: targetHsv.h,
              s: Math.min(0.5, (origHsv.s + targetS) * 0.5), // Average saturation with lower cap
              v: Math.min(1, Math.max(origHsv.v * 0.9, targetV * 0.8)) // Better brightness preservation
            };

            const blendedRgb = hsvToRgb(blendedHsv.h, blendedHsv.s, blendedHsv.v);

            // Linear interpolation with original color
            // Adaptive blending based on color removal state
            const blendFactor = isRemovingColor ? 0 : (maskAlpha * 0.6);
            workingImageData.data[i] = Math.round(origR * (1 - blendFactor) + blendedRgb.r * blendFactor);
            workingImageData.data[i + 1] = Math.round(origG * (1 - blendFactor) + blendedRgb.g * blendFactor);
            workingImageData.data[i + 2] = Math.round(origB * (1 - blendFactor) + blendedRgb.b * blendFactor);
          }
        }
      }

      // Put the processed image back
      ctx.putImageData(workingImageData, 0, 0);

      if (currentColor && !isRemovingColor) {
        // Apply the final blended result
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        // No need to draw from offscreenCanvas since workingImageData is already applied
      }

      // Apply wallpaper if available (regardless of color state)
      // Apply wallpaper if selected
      if (wallpaperUrl && selectedSegment === clickedSegment.id) {
        // Create a clipping path for the selected wall
        ctx.save();
        ctx.clip(path, 'evenodd');

        // Load and apply wallpaper
        const patternImg = new Image();
        await new Promise<void>((resolve, reject) => {
          patternImg.onload = () => {
            try {
              // Get the bounding box of the wall segment
              const bbox = getBoundingBox(path, ctx);
              
              // Save current state
              ctx.save();
              
              // Set up proper blending for transparency
              ctx.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = 1.0;
              
              // Draw the wallpaper scaled to fit the wall segment
              ctx.drawImage(
                patternImg,
                bbox.x, bbox.y,
                bbox.width, bbox.height
              );
              
              // Restore context state
              ctx.restore();
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          patternImg.onerror = () => reject(new Error('Failed to load wallpaper'));
          patternImg.src = wallpaperUrl;
        });
        ctx.restore();
      }
      ctx.restore();

      // Update history
      const finalImageUrl = canvas.toDataURL();
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({
        image_id: imageId,
        imageUrl: finalImageUrl,
        segments
      });
      setHistory(newHistory);
      setHistoryIndex(prev => prev + 1);

      logAction('Color applied locally', {
        segmentId: clickedSegment.id,
        color: currentColor,
        historyLength: newHistory.length,
        currentIndex: historyIndex + 1
      });
    } catch (error) {
      logError('Segment color application', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Create a pattern from an image URL with transparency support
  const createPattern = async (imageUrl: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    const size = 1200; // Larger size for better quality
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Failed to get canvas context');

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Clear canvas to ensure transparency
          ctx.clearRect(0, 0, size, size);
          
          // Calculate scaling to fit the image proportionally
          const scale = Math.min(size / img.width, size / img.height);
          const width = img.width * scale;
          const height = img.height * scale;
          
          // Draw single scaled image
          ctx.drawImage(
            img,
            (size - width) / 2, (size - height) / 2, // Center the image
            width, height
          );

          // Apply minimal blur without affecting transparency
          ctx.filter = 'blur(0.5px)';
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';

          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  };

  // Helper function to get bounding box of a path
  const getBoundingBox = (path: Path2D, ctx: CanvasRenderingContext2D): { x: number, y: number, width: number, height: number } => {
    // Default bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Sample points along the path to find bounds
    for (let x = 0; x < ctx.canvas.width; x += 10) {
      for (let y = 0; y < ctx.canvas.height; y += 10) {
        if (ctx.isPointInPath(path, x, y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Check if a point is near or inside a wall boundary using SVG Path
  const isPointInPath = (point: [number, number], pathData: string): boolean => {
    if (!canvasRef.current) return false;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Create path without scaling since SVG viewBox handles scaling
    const path = new Path2D(pathData);
    const [x, y] = point;

    // Point coordinates are already in SVG space due to viewBox
    const result = ctx.isPointInPath(path, x, y);

    return result;
  };

  const undo = () => {
    logAction('Undo requested', {
      currentIndex: historyIndex,
      historyLength: history.length
    });
    if (historyIndex <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    const prevEntry = history[newIndex];

    setIsProcessing(true);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      setHistoryIndex(newIndex);
      setSegments(prevEntry.segments);
      setIsProcessing(false);
      logAction('Undo complete', {
        newIndex,
        imageUrl: prevEntry.imageUrl
      });
    };
    img.onerror = () => {
      setIsProcessing(false);
      logError('Undo operation', 'Failed to load image');
    };
    img.src = prevEntry.imageUrl;
  };

  const redo = () => {
    logAction('Redo requested', {
      currentIndex: historyIndex,
      historyLength: history.length
    });
    if (historyIndex >= history.length - 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    const nextEntry = history[newIndex];

    setIsProcessing(true);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      setHistoryIndex(newIndex);
      setSegments(nextEntry.segments);
      setIsProcessing(false);
      logAction('Redo complete', {
        newIndex,
        imageUrl: nextEntry.imageUrl
      });
    };
    img.onerror = () => {
      setIsProcessing(false);
      logError('Redo operation', 'Failed to load image');
    };
    img.src = nextEntry.imageUrl;
  };

  if (!image || !image.complete) {
    return (
      <CustomizerContainer>
        <CanvasContainer>
          <LoadingOverlay>Loading image...</LoadingOverlay>
        </CanvasContainer>
      </CustomizerContainer>
    );
  }

  if (!imageId) {
    return (
      <CustomizerContainer>
        <CanvasContainer>
          <LoadingOverlay>Missing image ID</LoadingOverlay>
        </CanvasContainer>
      </CustomizerContainer>
    );
  }

  return (
    <CustomizerContainer>
      <ToolbarContainer>
        {!wallpaperUrl && (
          <ToolButton
            onClick={() => document.getElementById('wallpaper-upload')?.click()}
            disabled={isProcessing}
            title="Add Wallpaper"
          >
            📝
          </ToolButton>
        )}
        {wallpaperUrl && (
          <ToolButton
            onClick={async () => {
              if (!canvasRef.current || !image || isProcessing) return;

              setIsProcessing(true);
              try {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Reset to original image
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                // Clean up URL and state
                if (wallpaperUrl) {
                  URL.revokeObjectURL(wallpaperUrl);
                }
                setWallpaperUrl(null);
                setWallpaperFile(null);
                setSelectedSegment(null);

                // Reset file input
                const fileInput = document.getElementById('wallpaper-upload') as HTMLInputElement;
                if (fileInput) {
                  fileInput.value = '';
                }

                // Update history
                const finalImageUrl = canvas.toDataURL();
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push({
                  image_id: imageId,
                  imageUrl: finalImageUrl,
                  segments
                });
                setHistory(newHistory);
                setHistoryIndex(prev => prev + 1);
              } catch (error) {
                logError('Wallpaper removal', error);
              } finally {
                setIsProcessing(false);
              }
            }}
            disabled={isProcessing}
            title="Remove Wallpaper"
          >
            ❌
          </ToolButton>
        )}
        <ToolButton
          onClick={removeAllColorOverlays}
          disabled={isProcessing}
          title="Remove All Color Overlays"
        >
          🎨❌
        </ToolButton>
        <ToolButton
          onClick={undo}
          disabled={historyIndex <= 0 || isProcessing}
          title="Undo"
        >
          <MdUndo />
        </ToolButton>
        <ToolButton
          onClick={redo}
          disabled={historyIndex >= history.length - 1 || isProcessing}
          title="Redo"
        >
          <MdRedo />
        </ToolButton>
      </ToolbarContainer>
      <CanvasContainer>
        <Canvas
          ref={canvasRef}
        />
        {/* Hidden file input for wallpaper */}
        <input
          type="file"
          style={{ display: 'none' }}
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && !isProcessing && canvasRef.current && image) {
              setIsProcessing(true);
              try {
                setWallpaperFile(file);
                const url = URL.createObjectURL(file);
                const pattern = await createPattern(url);

                // Clean up old URL object if it exists
                if (wallpaperUrl) {
                  URL.revokeObjectURL(wallpaperUrl);
                }

                setWallpaperUrl(pattern);

                // Automatically apply wallpaper to all segments
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Draw base image
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                // Create pattern for all segments
                const patternCanvas = document.createElement('canvas');
                // Create pattern canvas at image size
                patternCanvas.width = canvas.width;
                patternCanvas.height = canvas.height;
                const patternCtx = patternCanvas.getContext('2d');
                if (!patternCtx) return;

                const patternImg = new Image();
                await new Promise<void>((resolve, reject) => {
                  patternImg.onload = () => {
                    // Scale and draw wallpaper to match image dimensions
                    patternCtx.drawImage(
                      patternImg,
                      0, 0,
                      canvas.width, canvas.height
                    );
                    resolve();
                  };
                  patternImg.onerror = reject;
                  patternImg.src = pattern;
                });

                // Clear canvas and apply base image
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                // Apply pattern once to each segment - single layer only
                for (const segment of segments) {
                  const path = new Path2D(segment.pathData);
                  ctx.save();
                  
                  // Clip to wall segment
                  ctx.clip(path, 'evenodd');
                  
                  // Draw the single scaled wallpaper
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.globalAlpha = 1.0;
                  ctx.drawImage(patternCanvas, 0, 0);
                  
                  ctx.restore();
                }

                // Update history
                const finalImageUrl = canvas.toDataURL();
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push({
                  image_id: imageId,
                  imageUrl: finalImageUrl,
                  segments
                });
                setHistory(newHistory);
                setHistoryIndex(prev => prev + 1);

              } catch (error) {
                logError('Wallpaper upload', error);
                setWallpaperFile(null);
                setWallpaperUrl(null);
              } finally {
                setIsProcessing(false);
              }
            }
          }}
          id="wallpaper-upload"
        />

        <SegmentOverlay
          viewBox={`0 0 ${image.width} ${image.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: canvasRef.current?.clientWidth || '100%',
            height: canvasRef.current?.clientHeight || '100%'
          }}
        >
          {segments.map(segment => (
            <g key={segment.id}>
              {/* Base color layer */}
              <path
                data-segment-id={`color-${segment.id}`}
                d={segment.pathData}
                fill={segment.id === selectedSegment ? currentColor || 'none' : 'none'}
                fillRule="evenodd"
                style={{
                  opacity: (segment.id === selectedSegment && currentColor) ? 0.6 : 0,
                  mixBlendMode: 'overlay',
                  transition: 'all 0.3s ease',
                }}
              />
              {/* Wall boundary - visible only on hover */}
              <path
                data-segment-id={`boundary-${segment.id}`}
                d={segment.pathData}
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                style={{
                  opacity: 0,
                  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))',
                  transition: 'all 0.3s ease',
                  pointerEvents: 'none',
                }}
              />
              {/* Invisible interaction area */}
              <path
                d={segment.pathData}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.preventDefault();
                  handleSegmentClick(segment.id).catch(error => {
                    logError('Segment click handler', error);
                    setIsProcessing(false);
                  });
                }}
                onMouseEnter={() => {
                  // Show boundary
                  const boundaryPath = document.querySelector(`path[data-segment-id="boundary-${segment.id}"]`);
                  if (boundaryPath) {
                    (boundaryPath as SVGPathElement).style.opacity = '1';
                  }
                  // Highlight color layer
                  const colorPath = document.querySelector(`path[data-segment-id="color-${segment.id}"]`);
                  if (colorPath) {
                    const hasColor = segment.id === selectedSegment && currentColor;
                    (colorPath as SVGPathElement).style.opacity = hasColor ? '0.75' : '0';
                  }
                  // Highlight wallpaper if present
                  const wallpaperPath = document.querySelector(`path[data-segment-id="wallpaper-${segment.id}"]`);
                  if (wallpaperPath) {
                    // Remove wallpaper opacity adjustment on hover
                  }
                }}
                onMouseLeave={() => {
                  // Hide boundary
                  const boundaryPath = document.querySelector(`path[data-segment-id="boundary-${segment.id}"]`);
                  if (boundaryPath) {
                    (boundaryPath as SVGPathElement).style.opacity = '0';
                  }
                  // Reset color and wallpaper opacity
                  const colorPath = document.querySelector(`path[data-segment-id="color-${segment.id}"]`);
                  if (colorPath) {
                    (colorPath as SVGPathElement).style.opacity = currentColor ? '0.6' : '0';
                  }
                  // Remove wallpaper opacity reset
                }}
              />
            </g>
          ))}
        </SegmentOverlay>
        {isProcessing && (
          <LoadingOverlay>
            Processing...
          </LoadingOverlay>
        )}
      </CanvasContainer>
      {decorationAnalysis && <DecorationAnalysis analysis={decorationAnalysis} />}
    </CustomizerContainer>
  );
};

export default ColorCustomizer;
