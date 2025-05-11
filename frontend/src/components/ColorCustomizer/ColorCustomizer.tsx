<<<<<<< HEAD
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
    const initializeImage = async () => {
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

        logAction('Detecting walls', { image_id: imageId });
        const wallsResponse = await api.detectWalls(imageId);
        logAction('Wall detection successful', {
          wallCount: wallsResponse.walls.length
        });

        logAction('Processing walls response', {
          totalWalls: wallsResponse.walls.length,
          firstWall: wallsResponse.walls[0] ? {
            id: wallsResponse.walls[0].mask_id,
            pathSample: wallsResponse.walls[0].svg_path.substring(0, 50) + '...',
            area: wallsResponse.walls[0].area,
            confidence: wallsResponse.walls[0].confidence,
            dimensions: wallsResponse.walls[0].dimensions
          } : 'no walls found',
          imageDimensions: { width: image.width, height: image.height }
        });

        if (!wallsResponse.walls.length) {
          throw new Error('No walls detected in the image');
        }

        // Convert wall data to segments
        const wallSegments = wallsResponse.walls.map(wall => ({
          id: wall.mask_id,
          pathData: wall.svg_path,
          area: wall.area,
          confidence: wall.confidence,
          dimensions: wall.dimensions
        }));
        if (wallSegments.length === 0) {
          throw new Error('No valid wall segments found in the response');
        }

        // Log first segment details if available
        if (wallSegments.length > 0) {
          const firstSegment = wallSegments[0];
          logAction('First wall segment processed', {
            id: firstSegment.id,
            pathPreview: firstSegment.pathData.substring(0, 50) + '...',
            area: firstSegment.area,
            confidence: firstSegment.confidence
          });
        }

        // Update segments and history
        // Create initial history entry with original image
        const initialEntry = {
          image_id: wallsResponse.image_id,
          imageUrl: wallsResponse.preview_url,
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

    initializeImage();

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
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [image, history, historyIndex, isShowingOriginal, isProcessing]);

  const handleSegmentClick = (segmentId: string) => {
    if (isProcessing || !canvasRef.current || !image) return;

    const clickedSegment = segments.find(segment => segment.id === segmentId);
    if (!clickedSegment) return;

    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      logAction('Segment selected', {
        segmentId: clickedSegment.id,
        color: currentColor,
        area: clickedSegment.area,
        confidence: clickedSegment.confidence
      });

      setSelectedSegment(clickedSegment.id);

      // Setup for seamless color blending
      ctx.save();
      
      // Draw original image
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // Create path from SVG data
      const path = new Path2D(clickedSegment.pathData);
      
      // Scale the path to match canvas dimensions
      const scaleX = canvas.width / image.width;
      const scaleY = canvas.height / image.height;
      ctx.scale(scaleX, scaleY);

      // Set blending for better texture preservation
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'overlay';
      
      // Apply the new color with proper handling of holes
      ctx.fillStyle = currentColor;
      ctx.fill(path, 'evenodd');

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

  return (
    <CustomizerContainer>
      <ToolbarContainer>
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
        <SegmentOverlay
          style={{
            transform: canvasRef.current
              ? `scale(${canvasRef.current.clientWidth / image.width}, ${canvasRef.current.clientHeight / image.height})`
              : 'none'
          }}
        >
          {segments.map(segment => (
            <g key={segment.id}>
              {/* Colored wall fill */}
              <path
                data-segment-id={`fill-${segment.id}`}
                d={segment.pathData}
                fill={segment.id === selectedSegment ? currentColor : getWallColor(segment.id)}
                fillRule="evenodd"
                style={{
                  opacity: 1,
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
                onClick={() => handleSegmentClick(segment.id)}
                onMouseEnter={() => {
                  // Show boundary
                  const boundaryPath = document.querySelector(`path[data-segment-id="boundary-${segment.id}"]`);
                  if (boundaryPath) {
                    (boundaryPath as SVGPathElement).style.opacity = '1';
                  }
                  // Highlight fill
                  const fillPath = document.querySelector(`path[data-segment-id="fill-${segment.id}"]`);
                  if (fillPath) {
                    (fillPath as SVGPathElement).style.opacity = '0.9';
                  }
                }}
                onMouseLeave={() => {
                  // Hide boundary
                  const boundaryPath = document.querySelector(`path[data-segment-id="boundary-${segment.id}"]`);
                  if (boundaryPath) {
                    (boundaryPath as SVGPathElement).style.opacity = '0';
                  }
                  // Reset fill
                  const fillPath = document.querySelector(`path[data-segment-id="fill-${segment.id}"]`);
                  if (fillPath) {
                    (fillPath as SVGPathElement).style.opacity = '1';
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

=======
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
`;

interface ColorCustomizerProps {
  image: HTMLImageElement;
  imageId: string;
  currentColor: string;
}

interface WallSegment {
  id: string;
  coordinates: [number, number][];
}

interface HistoryEntry {
  image_id: string;
  imageUrl: string;
  segments: WallSegment[];
}

const ColorCustomizer: React.FC<ColorCustomizerProps> = ({ image, imageId, currentColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<WallSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });

  // Update scale whenever canvas size changes
  useEffect(() => {
    const updateScale = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Get the display dimensions
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        // Calculate scale based on original image dimensions
        setScale({
          x: image.width / displayWidth,
          y: image.height / displayHeight
        });

        logAction('Scale updated', {
          original: { width: image.width, height: image.height },
          display: { width: displayWidth, height: displayHeight },
          scale: {
            x: image.width / displayWidth,
            y: image.height / displayHeight
          }
        });
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [image]);

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

  useEffect(() => {
    const initializeImage = async () => {
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
        
        logAction('Detecting walls', { image_id: imageId });
        const wallsResponse = await api.detectWalls(imageId);
        logAction('Wall detection successful', {
          wallCount: wallsResponse.walls.length
        });

        logAction('Converting wall data to segments', {
          wallCount: wallsResponse.walls.length,
          firstWallSample: wallsResponse.walls[0]?.coordinates.slice(0, 5),
          dimensions: {
            width: image.width,
            height: image.height
          }
        });
        const wallSegments = wallsResponse.walls.map(wall => ({
          id: wall.mask_id,
          coordinates: wall.coordinates
        }));

        // Log scaled coordinates for first segment
        if (wallSegments.length > 0) {
          const firstSegment = wallSegments[0];
          const sampleCoords = firstSegment.coordinates.slice(0, 5).map(([row, col]) => ({
            original: [row, col],
            transformed: [col, row],
            normalized: [col / image.width, row / image.height]
          }));
          logAction('Sample coordinates transformation', {
            segmentId: firstSegment.id,
            sampleCoords
          });
        }

        // Update segments and history
        // Create initial history entry with original image
        const initialEntry = {
          image_id: wallsResponse.image_id,
          imageUrl: wallsResponse.preview_url,
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

    initializeImage();
  }, [image]);

  const handleSegmentClick = async (segmentId: string) => {
    if (isProcessing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const clickedSegment = segments.find(segment => segment.id === segmentId);
    if (clickedSegment) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      logAction('Segment selected', {
        segmentId: clickedSegment.id,
        color: currentColor,
        coordinates: {
          sample: clickedSegment.coordinates.slice(0, 5),
          total: clickedSegment.coordinates.length
        }
      });
      setSelectedSegment(clickedSegment.id);
      try {
        setIsProcessing(true);
        const currentEntry = history[historyIndex];
        const colorResponse = await api.applyColor(
          currentEntry.image_id,
          currentColor,
          [clickedSegment.id]
        );

        // Update history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({
          image_id: colorResponse.image_id,
          imageUrl: colorResponse.processed_image_url,
          segments
        });
        setHistory(newHistory);
        setHistoryIndex(prev => prev + 1);

        // Load and handle new image
        const updateCanvasWithNewImage = async () => {
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context');

          // Load new image with error handling
          const newImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';  // Handle CORS
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load updated image'));
            img.src = colorResponse.processed_image_url;
          });

          // Update canvas dimensions if needed
          if (canvas.width !== newImage.width || canvas.height !== newImage.height) {
            canvas.width = newImage.width;
            canvas.height = newImage.height;
            logAction('Canvas dimensions updated', {
              width: canvas.width,
              height: canvas.height
            });
          }

          // Clear and draw new image
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(newImage, 0, 0);

          logAction('Canvas updated with new image', {
            imageUrl: colorResponse.processed_image_url,
            dimensions: {
              canvas: { width: canvas.width, height: canvas.height },
              image: { width: newImage.width, height: newImage.height }
            }
          });
        };

        await updateCanvasWithNewImage();

        logAction('Image updated', {
          url: colorResponse.processed_image_url,
          historyLength: newHistory.length,
          currentIndex: historyIndex + 1
        });
      } catch (error) {
        logError('Color application', error);
        alert('Failed to change wall color. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const isPointInPolygon = (clickPoint: [number, number], polygon: [number, number][]) => {
    if (!canvasRef.current) return false;

    // Convert click coordinates to percentages
    const [clickX, clickY] = clickPoint;
    const percentX = clickX / canvasRef.current.clientWidth;
    const percentY = clickY / canvasRef.current.clientHeight;

    // Convert polygon coordinates from [row, col] to normalized [x, y]
    const normalizedPolygon = polygon.map(([row, col]) => [
      col / image.width,  // col becomes x
      row / image.height  // row becomes y
    ]);

    let inside = false;
    for (let i = 0, j = normalizedPolygon.length - 1; i < normalizedPolygon.length; j = i++) {
      const [xi, yi] = normalizedPolygon[i];
      const [xj, yj] = normalizedPolygon[j];

      const intersect = ((yi > percentY) !== (yj > percentY))
        && (percentX < (xj - xi) * (percentY - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }

    return inside;
  };

  const undo = async () => {
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

    try {
      setIsProcessing(true);
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(null);
        };
        img.onerror = () => {
          reject(new Error('Failed to load previous image'));
        };
        img.src = prevEntry.imageUrl;
      });
      
      logAction('Undo complete', {
        newIndex,
        imageUrl: prevEntry.imageUrl
      });
    } catch (error) {
      logError('Undo operation', error);
      alert('Failed to load previous image. Please try again.');
    } finally {
      setIsProcessing(false);
    }

    setHistoryIndex(newIndex);
    setSegments(prevEntry.segments);
  };

  const redo = async () => {
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

    try {
      setIsProcessing(true);
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(null);
        };
        img.onerror = () => {
          reject(new Error('Failed to load next image'));
        };
        img.src = nextEntry.imageUrl;
      });
      
      logAction('Redo complete', {
        newIndex,
        imageUrl: nextEntry.imageUrl
      });
    } catch (error) {
      logError('Redo operation', error);
      alert('Failed to load next image. Please try again.');
    } finally {
      setIsProcessing(false);
    }

    setHistoryIndex(newIndex);
    setSegments(nextEntry.segments);
  };

  return (
    <CustomizerContainer>
      <ToolbarContainer>
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
        <SegmentOverlay>
          {segments.map((segment) => {
            // Scale coordinates to match canvas dimensions
            // Backend sends coordinates as [row, col] pairs from np.where()
            // We need to:
            // 1. Swap row/col to x/y
            // 2. Scale to canvas dimensions
            const scaledCoords = segment.coordinates.map(([row, col]) => {
              // Convert from [row, col] to [x, y]
              const x = col; // column becomes x
              const y = row; // row becomes y
              
              // Get percentage of position relative to original image
              const percentX = x / image.width;
              const percentY = y / image.height;
              
              // Convert percentage to display coordinates
              const displayX = percentX * canvasRef.current!.clientWidth;
              const displayY = percentY * canvasRef.current!.clientHeight;
              
              return [displayX, displayY];
            });

            return (
              <path
                key={segment.id}
                d={`M ${scaledCoords.map(([x, y]) => `${x},${y}`).join(' L ')} Z`}
              fill="rgba(128, 128, 128, 0.1)"
              stroke={segment.id === selectedSegment ? '#007bff' : '#666'}
              strokeWidth={segment.id === selectedSegment ? "3" : "1"}
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onClick={() => handleSegmentClick(segment.id)}
              onMouseEnter={(e) => {
                const target = e.target as SVGPathElement;
                target.style.fill = 'rgba(128, 128, 128, 0.2)';
                target.style.strokeWidth = '2';
              }}
              onMouseLeave={(e) => {
                const target = e.target as SVGPathElement;
                target.style.fill = 'rgba(128, 128, 128, 0.1)';
                target.style.strokeWidth = segment.id === selectedSegment ? '3' : '1';
              }}
              />
            );
          })}
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

>>>>>>> 1a852cdd1228d46b5ddff3060041d7484a697140
export default ColorCustomizer;