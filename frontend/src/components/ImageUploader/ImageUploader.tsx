import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { MdCloudUpload, MdImage } from 'react-icons/md';

const UploadContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
`;

const UploadArea = styled.div`
  width: 100%;
  min-height: 400px;
  border: 3px dashed #e0e0e0;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: #007bff;
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, #f3f4f6 25%, transparent 25%),
                linear-gradient(-45deg, #f3f4f6 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #f3f4f6 75%),
                linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    opacity: 0.2;
    z-index: -1;
  }
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const UploadIcon = styled(MdCloudUpload)`
  font-size: 64px;
  color: #007bff;
  margin-bottom: 20px;
`;

const ImageIcon = styled(MdImage)`
  font-size: 32px;
  color: #666;
  margin-right: 10px;
`;

const UploadText = styled.div`
  text-align: center;
  color: #333;
`;

const MainText = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #007bff;
`;

const SubText = styled.p`
  font-size: 16px;
  color: #666;
  margin-bottom: 20px;
`;

const SupportedFormats = styled.div`
  font-size: 14px;
  color: #888;
  margin-top: 10px;
`;

const UploadButton = styled.button`
  padding: 12px 24px;
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
  }
`;

const DragActiveOverlay = styled.div<{ $isDragging: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 123, 255, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: #007bff;
  opacity: ${props => props.$isDragging ? 1 : 0};
  pointer-events: none;
  transition: opacity 0.3s ease;
`;

interface ImageUploaderProps {
  onImageUpload: (image: HTMLImageElement) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const logAction = (action: string, details?: any) => {
    console.log(`📤 ImageUploader - ${action}`, details || '');
  };

  const logError = (action: string, error: any) => {
    console.error(`❌ ImageUploader - ${action} Failed:`, {
      message: error.message,
      details: error
    });
  };

  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      logAction('File selected', {
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024).toFixed(2)}KB`
      });

      if (!file.type.startsWith('image/')) {
        logError('File validation', new Error('Invalid file type'));
        alert('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          logAction('File read complete');
          setPreview(e.target.result as string);
          const img = new Image();
          img.src = e.target.result as string;
          img.onload = () => {
            logAction('Image loaded', {
              width: img.width,
              height: img.height
            });
            onImageUpload(img);
          };
        }
      };
      reader.onerror = (e) => {
        logError('File reading', reader.error);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      logAction('File dropped', {
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024).toFixed(2)}KB`
      });

      if (!file.type.startsWith('image/')) {
        logError('File validation', new Error('Invalid file type'));
        alert('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          logAction('File read complete');
          setPreview(e.target.result as string);
          const img = new Image();
          img.src = e.target.result as string;
          img.onload = () => {
            logAction('Image loaded', {
              width: img.width,
              height: img.height
            });
            onImageUpload(img);
          };
        }
      };
      reader.onerror = (e) => {
        logError('File reading', reader.error);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
    logAction('Drag over');
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    logAction('Drag leave');
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <UploadContainer>
      <UploadArea
        onClick={triggerFileInput}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {preview ? (
          <PreviewImage src={preview} alt="Preview" />
        ) : (
          <UploadText>
            <UploadIcon />
            <MainText>Upload Your Room Image</MainText>
            <SubText>Drag and drop your image here or click to browse</SubText>
            <UploadButton onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}>
              <ImageIcon />
              Choose Image
            </UploadButton>
            <SupportedFormats>
              Supported formats: JPG, PNG, WEBP
            </SupportedFormats>
          </UploadText>
        )}
        <DragActiveOverlay $isDragging={isDragging}>
          Drop your image here
        </DragActiveOverlay>
      </UploadArea>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />
    </UploadContainer>
  );
};

export default ImageUploader;