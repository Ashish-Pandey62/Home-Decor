import React from 'react';
import styled from 'styled-components';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

const SliderContainer = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
`;

const SliderLabel = styled.div`
  position: absolute;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
`;

const LeftLabel = styled(SliderLabel)`
  top: 10px;
  left: 10px;
`;

const RightLabel = styled(SliderLabel)`
  top: 10px;
  right: 10px;
`;

interface ComparisonSliderProps {
  originalImage: string;
  modifiedImage: string;
  onClose: () => void;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalImage,
  modifiedImage,
  onClose
}) => {
  return (
    <SliderContainer>
      <ReactCompareSlider
        itemOne={
          <>
            <ReactCompareSliderImage 
              src={originalImage} 
              alt="Original image" 
            />
            <LeftLabel>Original</LeftLabel>
          </>
        }
        itemTwo={
          <>
            <ReactCompareSliderImage 
              src={modifiedImage} 
              alt="Modified image" 
            />
            <RightLabel>Modified</RightLabel>
          </>
        }
        position={50}
        style={{
          height: '400px',
        }}
      />
    </SliderContainer>
  );
};

export default ComparisonSlider;