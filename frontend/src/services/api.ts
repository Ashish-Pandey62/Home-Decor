export const API_BASE_URL = 'http://localhost:8000/api/wall';

export interface Wall {
  mask_id: string;
  coordinates: [number, number][];
  area: number;
  confidence: number;
}

interface UploadResponse {
  image_id: string;
  filename: string;
  content_type: string;
  size: number;
  upload_url: string;
}

interface WallDetectionResponse {
  image_id: string;
  walls: Wall[];
  preview_url: string;
}

interface ColorResponse {
  image_id: string;
  processed_image_url: string;
  preview_url: string;
}

function logAPIRequest(endpoint: string, method: string, body?: any) {
  console.log(`🌐 API Request: ${method} ${endpoint}`);
  if (body) {
    console.log('Request Body:', body instanceof FormData ?
      'FormData: file upload' :
      JSON.stringify(body, null, 2)
    );
  }
}

function logAPIResponse(endpoint: string, response: any) {
  console.log(`✅ API Response: ${endpoint}`, response);
}

function logAPIError(endpoint: string, error: any) {
  console.error(`❌ API Error: ${endpoint}`, {
    message: error.message,
    ...(error.response && {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    })
  });
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  const endpoint = `${API_BASE_URL}/upload`;
  try {
    logAPIRequest(endpoint, 'POST');
    console.log('📁 File details:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)}KB`
    });

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const responseData = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseData);
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} - ${responseData}`);
    }

    logAPIResponse(endpoint, parsedData);
    return parsedData;
  } catch (error) {
    logAPIError(endpoint, error);
    if (error instanceof Error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    throw error;
  }
}

export async function detectWalls(imageId: string): Promise<WallDetectionResponse> {
  const endpoint = `${API_BASE_URL}/detect-walls`;
  try {
    const requestBody = { image_id: imageId };
    logAPIRequest(endpoint, 'POST', requestBody);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseData);
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(`Failed to detect walls: ${responseData}`);
    }

    logAPIResponse(endpoint, parsedData);
    return parsedData;
  } catch (error) {
    logAPIError(endpoint, error);
    throw error;
  }
}

export async function applyColor(
  imageId: string,
  color: string,
  wallIds: string[]
): Promise<ColorResponse> {
  const endpoint = `${API_BASE_URL}/apply-color`;
  try {
    // Convert hex color to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const requestBody = {
      image_id: imageId,
      color_rgb: [r, g, b],
      wall_ids: wallIds
    };

    logAPIRequest(endpoint, 'POST', requestBody);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseData);
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(`Failed to apply color: ${responseData}`);
    }

    logAPIResponse(endpoint, parsedData);
    return parsedData;
  } catch (error) {
    logAPIError(endpoint, error);
    throw error;
  }
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  
  if (!response.ok) {
    throw new Error('API health check failed');
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