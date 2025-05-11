import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { MdUndo, MdRedo } from 'react-icons/md';
import * as api from '../../services/api';

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
  transform-origin: 0 0;
`;

interface ColorCustomizerProps {
  image: HTMLImageElement;
  imageId: string;
  currentColor: string;
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
const createPattern = async (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Set size for pattern tile (adjust as needed)
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw image maintaining aspect ratio
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;
        ctx.drawImage(img, x, y, width, height);
      }
      resolve(canvas.toDataURL());
    };
    img.src = url;
  });
};

const ColorCustomizer: React.FC<ColorCustomizerProps> = ({ image, imageId, currentColor }) => {
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

  // Debug logging for state changes
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

        // Create initial history entry
        const initialEntry = {
          image_id: response.image_id,
          imageUrl: response.preview_url,
          segments: wallSegments
        };

        setSegments(wallSegments);
        setHistory([initialEntry]);
        setHistoryIndex(0);

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

  const handleSegmentClick = async (segmentId: string): Promise<void> => {
    if (isProcessing || !canvasRef.current || !image) {
      logAction('Segment click ignored', {
        isProcessing,
        hasCanvas: !!canvasRef.current,
        hasImage: !!image
      });
      return;
    }
    logAction('Starting segment click handler', {
      segmentId,
      hasWallpaper: !!wallpaperUrl,
    });



    const clickedSegment = segments.find(segment => segment.id === segmentId);
    if (!clickedSegment) return;

    setIsProcessing(true);
    logAction('Processing state details', {
      currentHistoryIndex: historyIndex,
      historyLength: history.length,
      selectedSegment,
      canvasDimensions: {
        width: canvasRef.current.width,
        height: canvasRef.current.height
      }
    });


    try {
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

      setSelectedSegment(clickedSegment.id);

      // Setup for drawing
      ctx.save();

      // Draw original image
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Create path from SVG data
      const path = new Path2D(clickedSegment.pathData);

      // Scale the path to match canvas dimensions
      const scaleX = canvas.width / image.width;
      const scaleY = canvas.height / image.height;
      ctx.scale(scaleX, scaleY);

      // First apply base color
      ctx.fillStyle = currentColor;
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fill(path, 'evenodd');

      // Reset composite operation for wallpaper
      ctx.globalCompositeOperation = 'source-over';

      // Then apply wallpaper if available
      if (wallpaperUrl && selectedSegment === clickedSegment.id) {
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = 200;
        patternCanvas.height = 200;
        const patternCtx = patternCanvas.getContext('2d');

        if (patternCtx) {
          const patternImg = new Image();
          await new Promise<void>((resolve, reject) => {
            patternImg.onload = () => {
              try {
                const scale = Math.min(200 / patternImg.width, 200 / patternImg.height);
                const width = patternImg.width * scale;
                const height = patternImg.height * scale;
                const x = (200 - width) / 2;
                const y = (200 - height) / 2;
                patternCtx.drawImage(patternImg, x, y, width, height);
                resolve();
              } catch (error) {
                reject(error);
              }
            };
            patternImg.onerror = () => reject(new Error('Failed to load pattern'));
            patternImg.src = wallpaperUrl;
          });

          const pattern = ctx.createPattern(patternCanvas, 'repeat');
          if (pattern) {
            pattern.setTransform(new DOMMatrix().scale(1 / scaleX, 1 / scaleY));
            ctx.fillStyle = pattern;
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = 0.45;
            ctx.fill(path, 'evenodd');
          }
        }
      }

      // Reset context state
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      // Update history
      const imageData = canvas.toDataURL();
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({
        image_id: imageId,
        imageUrl: imageData,
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

  // Check if a point is near or inside a wall boundary using SVG Path
  const isPointInPath = (point: [number, number], pathData: string): boolean => {
    if (!canvasRef.current) return false;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Create path and scale it
    const path = new Path2D(pathData);
    const scaleX = canvas.width / image.width;
    const scaleY = canvas.height / image.height;

    // Transform context to match the wall scale
    ctx.save();
    ctx.scale(scaleX, scaleY);

    // Check if point is in path
    const [x, y] = point;
    const scaledX = x / scaleX;
    const scaledY = y / scaleY;
    const result = ctx.isPointInPath(path, scaledX, scaledY);

    ctx.restore();
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
            onClick={() => {
              // Clean up old URL object if it exists
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
            }}
            disabled={isProcessing}
            title="Remove Wallpaper"
          >
            ❌
          </ToolButton>
        )}
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
            if (file) {
              try {
                setWallpaperFile(file);
                const url = URL.createObjectURL(file);
                const pattern = await createPattern(url);
                // Clean up old URL object if it exists
                if (wallpaperUrl) {
                  URL.revokeObjectURL(wallpaperUrl);
                }
                setWallpaperUrl(pattern);
              } catch (error) {
                logError('Wallpaper upload', error);
                setWallpaperFile(null);
                setWallpaperUrl(null);
              }
            }
          }}
          id="wallpaper-upload"
        />

        <SegmentOverlay
          style={{
            transform: canvasRef.current
              ? `scale(${canvasRef.current.clientWidth / image.width}, ${canvasRef.current.clientHeight / image.height})`
              : 'none'
          }}
        >
          {segments.map(segment => (
            <g key={segment.id}>
              <defs>
                {wallpaperUrl && (
                  <pattern
                    id={`wallpaper-${segment.id}`}
                    patternUnits="userSpaceOnUse"
                    width="200"
                    height="200"
                    patternTransform={`scale(${1 / scale.x}, ${1 / scale.y})`}
                  >
                    <image
                      href={wallpaperUrl}
                      x="0"
                      y="0"
                      width="200"
                      height="200"
                    />
                  </pattern>
                )}
              </defs>

              {/* Base color layer */}
              <path
                data-segment-id={`color-${segment.id}`}
                d={segment.pathData}
                fill={segment.id === selectedSegment ? currentColor : getWallColor(segment.id)}
                fillRule="evenodd"
                style={{
                  opacity: 0.6,
                  mixBlendMode: 'overlay',
                  transition: 'all 0.3s ease',
                }}
              />
              {/* Wallpaper overlay */}
              {wallpaperUrl && segment.id === selectedSegment && (
                <path
                  data-segment-id={`wallpaper-${segment.id}`}
                  d={segment.pathData}
                  fill={`url(#wallpaper-${segment.id})`}
                  fillRule="evenodd"
                  style={{
                    opacity: 0.5,
                    mixBlendMode: 'overlay',
                    transition: 'all 0.3s ease',
                  }}
                />
              )}
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
                    (colorPath as SVGPathElement).style.opacity = '0.75';
                  }
                  // Highlight wallpaper if present
                  const wallpaperPath = document.querySelector(`path[data-segment-id="wallpaper-${segment.id}"]`);
                  if (wallpaperPath) {
                    (wallpaperPath as SVGPathElement).style.opacity = '0.8';
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
                    (colorPath as SVGPathElement).style.opacity = '0.6';
                  }
                  const wallpaperPath = document.querySelector(`path[data-segment-id="wallpaper-${segment.id}"]`);
                  if (wallpaperPath) {
                    (wallpaperPath as SVGPathElement).style.opacity = '0.5';
                  }
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
    </CustomizerContainer>
  );
};

export default ColorCustomizer;