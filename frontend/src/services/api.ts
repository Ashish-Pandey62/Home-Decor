// Change base URL to use decoration endpoint
const getApiBaseUrl = () => {
  const apiURL = import.meta.env.VITE_API_URL;

  if (apiURL) {
    return apiURL;
  }

  return '';
};

export const API_BASE_URL = `${getApiBaseUrl()}/api`;
export const WALL_API_URL = `${API_BASE_URL}/wall`;
export const DECORATION_API_URL = `${API_BASE_URL}/decoration`;

// Add a helpful warning if using relative URL
if (!import.meta.env.VITE_API_URL) {
  console.warn(`⚠️ No VITE_API_URL set. Using relative path '${API_BASE_URL}'.
To use a specific API URL, set VITE_API_URL in your .env file:
- For development with IP: VITE_API_URL=http://192.168.1.64:8000
- For development with localhost: VITE_API_URL=http://localhost:8000
- For production: Set to your production API URL
`);
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
  mask: string;  // SVG string containing wall paths
  preview_url: string;
}

interface ColorResponse {
  image_id: string;
  processed_image_url: string;
  preview_url: string;
}

export interface DecorationAnalysisResponse {
  image_id: string;
  analysis: {
    background: string;
    good_points: string[];
    bad_points: string[];
    suggestions: string[];
  }
}

interface ColorRecommendationResponse {
  image_id: string;
  recommendations: {
    hex_color: string;
    preview_url: string;
  }[];
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
    type: error.constructor.name,
    cause: error.cause,
    ...(error.response && {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    }),
    // Additional connection diagnostics
    diagnostics: {
      url: endpoint,
      apiBase: API_BASE_URL,
      mode: import.meta.env.MODE,
      origin: window.location.origin,
      isOnline: navigator.onLine
    }
  });
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  const endpoint = `${WALL_API_URL}/upload`;
  try {
    // Check API health before upload
    try {
      const health = await checkHealth();
      console.log('🏥 API Health Check:', health);
    } catch (healthError) {
      console.error('🚨 API Health Check Failed:', healthError);
      throw new Error('API is not available');
    }

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
      credentials: 'include',  // Include cookies if needed
      headers: {
        // Let browser set the Content-Type for FormData
        ...(import.meta.env.DEV && {
          'Origin': window.location.origin
        })
      },
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
    // Enhance error information
    const enhancedError = new Error(
      error instanceof Error
        ? `Failed to upload image: ${error.message}`
        : 'Failed to upload image: Network error'
    );
    Object.defineProperty(enhancedError, 'cause', { value: error });

    // Try to determine if it's a CORS or connectivity issue
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn('🔍 Connection Diagnostics:', {
        'Backend URL': endpoint,
        'CORS Headers': {
          'credentials': 'include',
          'origin': window.location.origin
        },
        'Network Status': {
          'Online': navigator.onLine,
          'Connection Type': (navigator as any).connection?.type || 'unknown'
        },
        'Environment': {
          'Mode': import.meta.env.MODE,
          'API Base': API_BASE_URL
        }
      });
    }

    throw enhancedError;
  }
}

export async function detectWalls(imageId: string): Promise<WallDetectionResponse> {
  const endpoint = `${WALL_API_URL}/detect-walls`;
  try {
    const requestBody = { image_id: imageId };
    logAPIRequest(endpoint, 'POST', requestBody);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(import.meta.env.DEV && {
          'Origin': window.location.origin
        })
      },
      credentials: 'include',
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
    const enhancedError = new Error(
      error instanceof Error
        ? `Failed to detect walls: ${error.message}`
        : 'Failed to detect walls: Network error'
    );
    Object.defineProperty(enhancedError, 'cause', { value: error });

    // Try to determine if it's a CORS or connectivity issue
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn('🔍 Connection Diagnostics:', {
        'Backend URL': endpoint,
        'CORS Headers': {
          'credentials': 'include',
          'origin': window.location.origin
        },
        'Network Status': {
          'Online': navigator.onLine,
          'Connection Type': (navigator as any).connection?.type || 'unknown'
        },
        'Environment': {
          'Mode': import.meta.env.MODE,
          'API Base': API_BASE_URL
        }
      });
    }

    throw enhancedError;
  }
}

export async function applyColor(
  imageId: string,
  color: string,
  wallIds: string[]
): Promise<ColorResponse> {
  const endpoint = `${WALL_API_URL}/apply-color`;
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
        ...(import.meta.env.DEV && {
          'Origin': window.location.origin
        })
      },
      credentials: 'include',
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
    const enhancedError = new Error(
      error instanceof Error
        ? `Failed to apply color: ${error.message}`
        : 'Failed to apply color: Network error'
    );
    Object.defineProperty(enhancedError, 'cause', { value: error });

    // Try to determine if it's a CORS or connectivity issue
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn('🔍 Connection Diagnostics:', {
        'Backend URL': endpoint,
        'CORS Headers': {
          'credentials': 'include',
          'origin': window.location.origin
        },
        'Network Status': {
          'Online': navigator.onLine,
          'Connection Type': (navigator as any).connection?.type || 'unknown'
        },
        'Environment': {
          'Mode': import.meta.env.MODE,
          'API Base': API_BASE_URL
        }
      });
    }

    throw enhancedError;
  }
}

export async function checkHealth(): Promise<{ status: string }> {
  const endpoint = `${WALL_API_URL}/health`;
  console.log('🔍 Health Check URL:', endpoint);
  try {
    logAPIRequest(endpoint, 'GET');

    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(import.meta.env.DEV && {
          'Origin': window.location.origin
        })
      }
    });

    const responseData = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      console.error('Failed to parse health check response as JSON:', responseData);
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} - ${responseData}`);
    }

    logAPIResponse(endpoint, parsedData);
    return parsedData;
  } catch (error) {
    logAPIError(endpoint, error);
    const enhancedError = new Error(
      error instanceof Error
        ? `Health check failed: ${error.message}`
        : 'Health check failed: Network error'
    );
    Object.defineProperty(enhancedError, 'cause', { value: error });

    // Try to determine if it's a CORS or connectivity issue
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn('🔍 Health Check Diagnostics:', {
        'Backend URL': endpoint,
        'CORS Headers': {
          'credentials': 'include',
          'origin': window.location.origin
        },
        'Network Status': {
          'Online': navigator.onLine,
          'Connection Type': (navigator as any).connection?.type || 'unknown'
        },
        'Environment': {
          'Mode': import.meta.env.MODE,
          'API Base': API_BASE_URL,
          'Production': import.meta.env.PROD,
          'Custom URL': import.meta.env.VITE_API_URL || 'not set'
        }
      });
    }

    throw enhancedError;
  }
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

export async function getColorRecommendations(imageId: string, numColors: number = 4): Promise<ColorRecommendationResponse> {
  const endpoint = `${WALL_API_URL}/recommendations`;
  try {
    const requestBody = {
      image_id: imageId,
      num_colors: numColors
    };

    logAPIRequest(endpoint, 'POST', requestBody);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(import.meta.env.DEV && {
          'Origin': window.location.origin
        })
      },
      credentials: 'include',
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
      throw new Error(`Failed to get color recommendations: ${responseData}`);
    }

    logAPIResponse(endpoint, parsedData);
    return parsedData;
  } catch (error) {
    logAPIError(endpoint, error);
    const enhancedError = new Error(
      error instanceof Error
        ? `Failed to get color recommendations: ${error.message}`
        : 'Failed to get color recommendations: Network error'
    );
    Object.defineProperty(enhancedError, 'cause', { value: error });
    throw enhancedError;
  }
}

export async function analyzeDecoration(imageId: string): Promise<DecorationAnalysisResponse> {
  const endpoint = `${DECORATION_API_URL}/analyze`;
  try {
    console.log('🔍 Starting decoration analysis:', {
      endpoint,
      imageId,
      decorationApiUrl: DECORATION_API_URL,
      baseApiUrl: API_BASE_URL
    });
    const requestBody = { image_id: imageId };
    logAPIRequest(endpoint, 'POST', requestBody);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(import.meta.env.DEV && {
          'Origin': window.location.origin
        })
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.text();
    console.log('📥 Raw decoration analysis response:', responseData);
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
      console.log('✅ Parsed decoration analysis:', parsedData);
    } catch (e) {
      console.error('❌ Failed to parse response as JSON:', {
        error: e,
        responseData,
        contentType: response.headers.get('content-type')
      });
      throw new Error('Invalid JSON response from server');
    }

    if (!response.ok) {
      console.error('❌ Decoration analysis failed:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      throw new Error(`Failed to analyze decoration: ${responseData}`);
    }

    logAPIResponse(endpoint, parsedData);
    return parsedData;
  } catch (error) {
    logAPIError(endpoint, error);
    const enhancedError = new Error(
      error instanceof Error
        ? `Failed to analyze decoration: ${error.message}`
        : 'Failed to analyze decoration: Network error'
    );
    Object.defineProperty(enhancedError, 'cause', { value: error });
    throw enhancedError;
  }
}