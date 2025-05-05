import React, { useState } from 'react';
import styled from 'styled-components';
import { HexColorPicker } from 'react-colorful';

const ColorPickerContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 300px;
`;

const FormatToggle = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
`;

const FormatButton = styled.button<{ active: boolean }>`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: ${props => props.active ? '#007bff' : '#e9ecef'};
  color: ${props => props.active ? 'white' : 'black'};
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.active ? '#0056b3' : '#dee2e6'};
  }
`;

const ColorInput = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  margin-top: 10px;
`;

const RecentColors = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
`;

const ColorSwatch = styled.div<{ color: string }>`
  width: 30px;
  height: 30px;
  border-radius: 4px;
  background-color: ${props => props.color};
  cursor: pointer;
  border: 1px solid #ced4da;
`;

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [format, setFormat] = useState<'hex' | 'rgb'>('hex');
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgb(0, 0, 0)';
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const rgbToHex = (rgb: string): string => {
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return '#000000';
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  const handleColorChange = (newColor: string) => {
    onChange(newColor);
    if (!recentColors.includes(newColor)) {
      setRecentColors(prev => [newColor, ...prev.slice(0, 9)]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (format === 'hex' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
      handleColorChange(value);
    } else if (format === 'rgb' && /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/.test(value)) {
      handleColorChange(rgbToHex(value));
    }
  };

  return (
    <ColorPickerContainer>
      <FormatToggle>
        <FormatButton 
          active={format === 'hex'} 
          onClick={() => setFormat('hex')}
        >
          HEX
        </FormatButton>
        <FormatButton 
          active={format === 'rgb'} 
          onClick={() => setFormat('rgb')}
        >
          RGB
        </FormatButton>
      </FormatToggle>

      <HexColorPicker color={color} onChange={handleColorChange} />

      <ColorInput
        type="text"
        value={format === 'hex' ? color : hexToRgb(color)}
        onChange={handleInputChange}
        placeholder={format === 'hex' ? '#000000' : 'rgb(0, 0, 0)'}
      />

      {recentColors.length > 0 && (
        <>
          <h4>Recent Colors</h4>
          <RecentColors>
            {recentColors.map((recentColor, index) => (
              <ColorSwatch
                key={index}
                color={recentColor}
                onClick={() => handleColorChange(recentColor)}
                title={format === 'hex' ? recentColor : hexToRgb(recentColor)}
              />
            ))}
          </RecentColors>
        </>
      )}
    </ColorPickerContainer>
  );
};

export default ColorPicker;