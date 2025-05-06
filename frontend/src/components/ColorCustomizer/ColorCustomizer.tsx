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
  pointer-events: none;
`;

interface ColorCustomizerProps {
  image: HTMLImageElement;
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

const ColorCustomizer: React.FC<ColorCustomizerProps> = ({ image, currentColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<WallSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const logAction = (action: string, details?: any) => {
    console.log(`🎨 ColorCustomizer - ${action}`, details || '');
  };

  const logError = (action: string, error: any) => {
    console.error(`🚫 ColorCustomizer - ${action} Failed:`, {
      message: error.message,
      details: error
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

      // Draw initial image
      ctx.drawImage(image, 0, 0);

      try {
        setIsProcessing(true);
        
        logAction('Step 1: Uploading image');
        const imageFile = api.dataURLtoFile(canvas.toDataURL(), 'room.jpg');
        const uploadResponse = await api.uploadImage(imageFile);
        logAction('Upload successful', uploadResponse);
        
        logAction('Step 2: Detecting walls', { image_id: uploadResponse.image_id });
        const wallsResponse = await api.detectWalls(uploadResponse.image_id);
        logAction('Wall detection successful', {
          wallCount: wallsResponse.walls.length
        });
        
        logAction('Converting wall data to segments');
        const wallSegments = wallsResponse.walls.map(wall => ({
          id: wall.mask_id,
          coordinates: wall.coordinates
        }));
        
        // Update segments and history
        setSegments(wallSegments);
        setHistory([{
          image_id: wallsResponse.image_id,
          imageUrl: wallsResponse.preview_url,
          segments: wallSegments
        }]);
        setHistoryIndex(0);
      } catch (error) {
        logError('Image processing', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to process image: ${errorMessage}\n\nPlease ensure the backend server is running at ${api.API_BASE_URL}`);
      } finally {
        setIsProcessing(false);
      }
    };

    initializeImage();
  }, [image]);

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isProcessing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    logAction('Canvas click', { x, y });

    // Find clicked segment
    const clickedSegment = segments.find(segment => {
      // Check if point is inside polygon
      return isPointInPolygon([x, y], segment.coordinates);
    });

    if (clickedSegment) {
      logAction('Segment selected', {
        segmentId: clickedSegment.id,
        color: currentColor
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

        // Load and draw new image
        const newImage = new Image();
        newImage.src = colorResponse.processed_image_url;
        newImage.onload = () => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(newImage, 0, 0);
          }
        };
      } catch (error) {
        logError('Color application', error);
        alert('Failed to change wall color. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const isPointInPolygon = (point: [number, number], polygon: [number, number][]) => {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

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

    const img = new Image();
    img.src = prevEntry.imageUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };

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

    const img = new Image();
    img.src = nextEntry.imageUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };

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
          onClick={handleCanvasClick}
        />
        <SegmentOverlay>
          {segments.map((segment) => (
            <path
              key={segment.id}
              d={`M ${segment.coordinates.map(([x, y]) => `${x},${y}`).join(' L ')} Z`}
              fill="transparent"
              stroke={segment.id === selectedSegment ? '#007bff' : 'transparent'}
              strokeWidth="2"
            />
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