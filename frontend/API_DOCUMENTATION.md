# HomeDécor Backend API Documentation

## Base Information

- Base URL: `http://localhost:8000`
- API Base Path: `/api`
- API Version: v1

## API Workflow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend API
    participant SAM as SAM Model
    participant FS as File Storage

    %% Upload Image
    FE->>BE: POST /wall/upload
    BE->>FS: Save Image
    FS-->>BE: image_id, file_path
    BE-->>FE: ImageResponse

    %% Detect Walls
    FE->>BE: POST /wall/detect-walls
    BE->>SAM: Process Image
    SAM-->>BE: Wall Masks
    BE->>FS: Save Preview
    BE-->>FE: WallDetectionResponse

    %% Apply Color
    FE->>BE: POST /wall/apply-color
    BE->>BE: Process Color Change
    BE->>FS: Save Result
    BE-->>FE: ColorResponse
```

## CORS Settings

The API allows requests from the following origins:
- http://localhost:5173
- http://localhost:3000
- http://localhost:8080

## File Upload Restrictions

- Maximum file size: 10MB
- Allowed file extensions: .jpg, .jpeg, .png

## API Endpoints

### 1. Upload Image
Uploads an image for wall detection processing.

**Endpoint:** `POST /api/wall/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Image file (required)

**Response:**
```json
{
  "image_id": "string",
  "filename": "string",
  "content_type": "string",
  "size": "integer",
  "upload_url": "string"
}
```

### 2. Detect Walls
Processes an uploaded image to detect walls.

**Endpoint:** `POST /api/wall/detect-walls`

**Request:**
```json
{
  "image_id": "string"
}
```

**Response:**
```json
{
  "image_id": "string",
  "walls": [
    {
      "mask_id": "string",
      "coordinates": [[x, y], ...],
      "area": "integer",
      "confidence": "float"
    }
  ],
  "preview_url": "string"
}
```

### 3. Apply Color
Applies selected color to specified walls.

**Endpoint:** `POST /api/wall/apply-color`

**Request:**
```json
{
  "image_id": "string",
  "color_rgb": [r, g, b],  // Values between 0-255
  "wall_ids": ["string"]
}
```

**Response:**
```json
{
  "image_id": "string",
  "processed_image_url": "string",
  "preview_url": "string"
}
```

### 4. Health Check
Verify API health status.

**Endpoint:** `GET /api/wall/health`

**Response:**
```json
{
  "status": "healthy"
}
```

## Error Handling

The API returns appropriate HTTP status codes and error responses in the following format:

```json
{
  "detail": "Error description",
  "error_code": "ERROR_CODE"
}
```

Common error scenarios:
- 400: Invalid request (e.g., invalid image format, invalid RGB values)
- 413: File too large (over 10MB)
- 415: Unsupported file type
- 500: Server processing error

## Typical Usage Flow

1. Upload an image using the `/upload` endpoint
2. Use the received `image_id` to detect walls using `/detect-walls`
3. Use the `image_id` and detected `wall_ids` to apply colors using `/apply-color`

## Example Usage

```typescript
// 1. Upload image
const formData = new FormData();
formData.append('file', imageFile);

const uploadResponse = await fetch('/api/wall/upload', {
  method: 'POST',
  body: formData
});
const { image_id } = await uploadResponse.json();

// 2. Detect walls
const wallsResponse = await fetch('/api/wall/detect-walls', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ image_id })
});
const { walls, preview_url } = await wallsResponse.json();

// 3. Apply color
const colorResponse = await fetch('/api/wall/apply-color', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image_id,
    color_rgb: [255, 0, 0],  // Red color
    wall_ids: walls.map(wall => wall.mask_id)
  })
});
const { processed_image_url } = await colorResponse.json();