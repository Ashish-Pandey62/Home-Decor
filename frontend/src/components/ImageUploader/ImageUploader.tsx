import React, { useRef, useState } from 'react';
import styled from 'styled-components';

const UploadContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
`;

const UploadArea = styled.div`
  width: 100%;
  max-width: 600px;
  height: 300px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #666;
    background-color: #f9f9f9;
  }
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

const UploadButton = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #0056b3;
  }
`;

interface ImageUploaderProps {
  onImageUpload: (image: HTMLImageElement) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPreview(e.target.result as string);
          const img = new Image();
          img.src = e.target.result as string;
          img.onload = () => onImageUpload(img);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPreview(e.target.result as string);
          const img = new Image();
          img.src = e.target.result as string;
          img.onload = () => onImageUpload(img);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
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
      >
        {preview ? (
          <PreviewImage src={preview} alt="Preview" />
        ) : (
          <>
            <p>Drag and drop an image here</p>
            <p>or</p>
            <UploadButton onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}>
              Choose File
            </UploadButton>
          </>
        )}
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