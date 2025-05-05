import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { MdUndo, MdRedo } from 'react-icons/md';

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
  cursor: crosshair;
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

interface Point {
  x: number;
  y: number;
}

interface ColorCustomizerProps {
  image: HTMLImageElement;
  currentColor: string;
}

const ColorCustomizer: React.FC<ColorCustomizerProps> = ({ image, currentColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match image
    canvas.width = image.width;
    canvas.height = image.height;

    // Draw initial image
    ctx.drawImage(image, 0, 0);

    // Save initial state to history
    const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialState]);
    setHistoryIndex(0);
  }, [image]);

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Convert hex color to RGB
    const fillRGB = {
      r: parseInt(fillColor.slice(1, 3), 16),
      g: parseInt(fillColor.slice(3, 5), 16),
      b: parseInt(fillColor.slice(5, 7), 16)
    };

    // Get target color at click position
    const startPos = (startY * canvas.width + startX) * 4;
    const targetColor = {
      r: pixels[startPos],
      g: pixels[startPos + 1],
      b: pixels[startPos + 2]
    };

    // Color matching threshold
    const threshold = 30;

    const matchesTarget = (pos: number) => {
      return (
        Math.abs(pixels[pos] - targetColor.r) <= threshold &&
        Math.abs(pixels[pos + 1] - targetColor.g) <= threshold &&
        Math.abs(pixels[pos + 2] - targetColor.b) <= threshold
      );
    };

    const stack: Point[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      const pixelPos = (current.y * canvas.width + current.x) * 4;

      if (
        current.x < 0 ||
        current.x >= canvas.width ||
        current.y < 0 ||
        current.y >= canvas.height ||
        visited.has(`${current.x},${current.y}`) ||
        !matchesTarget(pixelPos)
      ) {
        continue;
      }

      visited.add(`${current.x},${current.y}`);

      // Set new color
      pixels[pixelPos] = fillRGB.r;
      pixels[pixelPos + 1] = fillRGB.g;
      pixels[pixelPos + 2] = fillRGB.b;

      // Add neighbors to stack
      stack.push(
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      );
    }

    ctx.putImageData(imageData, 0, 0);
    
    // Save to history
    const newState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
    setHistoryIndex(prev => prev + 1);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    setIsDrawing(true);
    floodFill(x, y, currentColor);
    setIsDrawing(false);
  };

  const undo = () => {
    if (historyIndex <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  return (
    <CustomizerContainer>
      <ToolbarContainer>
        <ToolButton 
          onClick={undo} 
          disabled={historyIndex <= 0}
          title="Undo"
        >
          <MdUndo />
        </ToolButton>
        <ToolButton 
          onClick={redo} 
          disabled={historyIndex >= history.length - 1}
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
      </CanvasContainer>
    </CustomizerContainer>
  );
};

export default ColorCustomizer;