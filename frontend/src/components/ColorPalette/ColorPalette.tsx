import React from 'react';
import styled from 'styled-components';

const PaletteContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 300px;
`;

const PaletteSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #333;
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
`;

const ColorSwatch = styled.div<{ color: string; selected?: boolean }>`
  width: 100%;
  padding-bottom: 100%;
  background-color: ${props => props.color};
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  border: 2px solid ${props => props.selected ? '#007bff' : 'transparent'};
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const predefinedPalettes = {
  modern: [
    '#2C3E50', '#E74C3C', '#ECF0F1', '#3498DB', '#2ECC71',
    '#F1C40F', '#9B59B6', '#34495E', '#1ABC9C', '#E67E22'
  ],
  natural: [
    '#DAC292', '#B9936C', '#8B7355', '#6B5E4C', '#F1E5D4',
    '#C2B280', '#A39171', '#7C6A46', '#8B7E66', '#E8DCC4'
  ],
  trending: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9E579D', '#574B90', '#303A52', '#FC9D9D'
  ]
};

interface ColorPaletteProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({
  selectedColor,
  onColorSelect
}) => {
  return (
    <PaletteContainer>
      <PaletteSection>
        <SectionTitle>Modern</SectionTitle>
        <ColorGrid>
          {predefinedPalettes.modern.map((color, index) => (
            <ColorSwatch
              key={`modern-${index}`}
              color={color}
              selected={selectedColor === color}
              onClick={() => onColorSelect(color)}
              title={color}
            />
          ))}
        </ColorGrid>
      </PaletteSection>

      <PaletteSection>
        <SectionTitle>Natural</SectionTitle>
        <ColorGrid>
          {predefinedPalettes.natural.map((color, index) => (
            <ColorSwatch
              key={`natural-${index}`}
              color={color}
              selected={selectedColor === color}
              onClick={() => onColorSelect(color)}
              title={color}
            />
          ))}
        </ColorGrid>
      </PaletteSection>

      <PaletteSection>
        <SectionTitle>Trending</SectionTitle>
        <ColorGrid>
          {predefinedPalettes.trending.map((color, index) => (
            <ColorSwatch
              key={`trending-${index}`}
              color={color}
              selected={selectedColor === color}
              onClick={() => onColorSelect(color)}
              title={color}
            />
          ))}
        </ColorGrid>
      </PaletteSection>
    </PaletteContainer>
  );
};

export default ColorPalette;