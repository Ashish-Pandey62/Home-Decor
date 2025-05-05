import { useState, useRef } from 'react';
import styled from 'styled-components';
import ImageUploader from './components/ImageUploader/ImageUploader';
import ColorCustomizer from './components/ColorCustomizer/ColorCustomizer';
import ColorPicker from './components/ColorPicker/ColorPicker';
import ComparisonSlider from './components/ComparisonSlider/ComparisonSlider';
import ColorPalette from './components/ColorPalette/ColorPalette';

const AppContainer = styled.div`
  min-height: 100vh;
  padding: 20px;
  background-color: #f8f9fa;
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
  margin-bottom: 30px;
`;

const MainContent = styled.div`
  display: flex;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  
  @media (max-width: 1200px) {
    flex-direction: column;
    align-items: center;
  }
`;

const EditorSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
`;

const SidePanel = styled.div`
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (max-width: 1200px) {
    width: 100%;
    max-width: 800px;
  }
`;

const CompareButton = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 20px;
  
  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

function App() {
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [currentColor, setCurrentColor] = useState('#007bff');
  const [showComparison, setShowComparison] = useState(false);
  const [originalDataUrl, setOriginalDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleImageUpload = (image: HTMLImageElement) => {
    setUploadedImage(image);
    
    // Create canvas to store original image data URL
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0);
      setOriginalDataUrl(canvas.toDataURL());
    }
  };

  const handleCompareClick = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setShowComparison(true);
    }
  };

  const getCurrentCanvasImage = (): string => {
    const canvas = document.querySelector('canvas');
    return canvas ? canvas.toDataURL() : '';
  };

  return (
    <AppContainer>
      <Title>HomeDécor - Room Color Customizer</Title>
      
      {!uploadedImage ? (
        <ImageUploader onImageUpload={handleImageUpload} />
      ) : (
        <MainContent>
          <EditorSection>
            <ColorCustomizer
              image={uploadedImage}
              currentColor={currentColor}
            />
            <CompareButton
              onClick={handleCompareClick}
              disabled={!uploadedImage}
            >
              Compare with Original
            </CompareButton>
          </EditorSection>

          <SidePanel>
            <ColorPicker
              color={currentColor}
              onChange={setCurrentColor}
            />
            <ColorPalette
              selectedColor={currentColor}
              onColorSelect={setCurrentColor}
            />
          </SidePanel>

          {showComparison && (
            <ComparisonSlider
              originalImage={originalDataUrl}
              modifiedImage={getCurrentCanvasImage()}
              onClose={() => setShowComparison(false)}
            />
          )}
        </MainContent>
      )}
    </AppContainer>
  );
}

export default App;
