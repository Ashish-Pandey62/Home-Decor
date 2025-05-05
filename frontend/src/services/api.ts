export interface WallSegment {
  id: string;
  coordinates: [number, number][];
}

interface ProcessedImage {
  imageUrl: string;
  segments: WallSegment[];
}

interface ColorChangeRequest {
  imageData: string;
  segmentId: string;
  color: string;
}

const API_BASE_URL = 'http://localhost:8000/api'; // Update with your backend URL

export async function uploadImage(file: File): Promise<ProcessedImage> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload image');
  }

  return response.json();
}

export async function changeWallColor({
  imageData,
  segmentId,
  color,
}: ColorChangeRequest): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/change-color`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageData,
      segmentId,
      color,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to change wall color');
  }

  const result = await response.json();
  return result.imageUrl;
}

export async function getWallSegments(imageId: string): Promise<WallSegment[]> {
  const response = await fetch(`${API_BASE_URL}/segments/${imageId}`);

  if (!response.ok) {
    throw new Error('Failed to get wall segments');
  }

  return response.json();
}

// Helper function to convert canvas data to File object
export function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}