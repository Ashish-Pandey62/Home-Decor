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

  const handleSegmentClick = (segmentId: string) => {
    if (isProcessing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const clickedSegment = segments.find(segment => segment.id === segmentId);
    if (!clickedSegment) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    logAction('Segment selected', {
      segmentId: clickedSegment.id,
      color: currentColor,
      coordinates: {
        sample: clickedSegment.coordinates.slice(0, 5),
        total: clickedSegment.coordinates.length
      }
    });

    setSelectedSegment(clickedSegment.id);
    
    // Create path for the segment
    ctx.beginPath();
    clickedSegment.coordinates.forEach(([row, col], index) => {
      const x = (col / image.width) * canvas.width;
      const y = (row / image.height) * canvas.height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    // Apply the new color
    ctx.fillStyle = currentColor;
    ctx.fill();

    // Update history
    const imageData = canvas.toDataURL();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      image_id: imageId, // Keep the same image_id since we're not sending to backend
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
      setIsProcessing(false);
      setHistoryIndex(newIndex);
      setSegments(prevEntry.segments);
      logAction('Undo complete', {
        newIndex,
        imageUrl: prevEntry.imageUrl
      });
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
      setIsProcessing(false);
      setHistoryIndex(newIndex);
      setSegments(nextEntry.segments);
      logAction('Redo complete', {
        newIndex,
        imageUrl: nextEntry.imageUrl
      });
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
                fill="none"
                stroke={segment.id === selectedSegment ? '#007bff' : getWallColor(segment.id)}
                strokeWidth={segment.id === selectedSegment ? "4" : "2.5"}
                strokeDasharray={segment.id === selectedSegment ? "none" : "none"}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => handleSegmentClick(segment.id)}
                onMouseEnter={(e) => {
                  const target = e.target as SVGPathElement;
                  target.style.fill = 'rgba(255, 255, 255, 0.1)';
                  target.style.strokeWidth = '5';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as SVGPathElement;
                  target.style.fill = 'none';
                  target.style.strokeWidth = segment.id === selectedSegment ? '4' : '2.5';
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

export default ColorCustomizer;