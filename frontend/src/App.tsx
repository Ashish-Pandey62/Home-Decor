import { useState } from 'react';
import styled from 'styled-components';
import ImageUploader from './components/ImageUploader/ImageUploader';
import ColorCustomizer from './components/ColorCustomizer/ColorCustomizer';
import ColorPicker from './components/ColorPicker/ColorPicker';
import ColorPalette from './components/ColorPalette/ColorPalette';
import * as api from './services/api';

const AppContainer = styled.div`
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 2.5rem;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
`;

const Subtitle = styled.p`
  text-align: center;
  color: #666;
  margin-bottom: 40px;
  font-size: 1.1rem;
  max-width: 600px;
  margin: 0 auto 40px;
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

const ErrorMessage = styled.div`
  color: #dc3545;
  background: #fff;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid #dc3545;
  margin: 20px auto;
  max-width: 600px;
  text-align: center;
`;

function App() {
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState('#007bff');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = async (image: HTMLImageElement) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Upload image to server
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        const imageFile = api.dataURLtoFile(canvas.toDataURL(), 'room.jpg');
        const uploadResponse = await api.uploadImage(imageFile);
        setImageId(uploadResponse.image_id);
        setUploadedImage(image);
      }
    } catch (err) {
      setError('Failed to process image. Please try again.');
      console.error('Error processing image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppContainer>
      <Title>HomeDécor - Room Color Customizer</Title>
      <Subtitle>
        Upload a photo of your room and explore different wall colors instantly.
        Select walls with a click and choose from our curated color palettes.
      </Subtitle>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {!uploadedImage ? (
        <ImageUploader onImageUpload={handleImageUpload} />
      ) : (
        <MainContent>
          <EditorSection>
            <ColorCustomizer
              image={uploadedImage}
              imageId={imageId!}
              currentColor={currentColor}
            />
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

        </MainContent>
      )}
    </AppContainer>
  );
}

export default App;
