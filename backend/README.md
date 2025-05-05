# HomeDécor Backend

FastAPI backend service for the HomeDécor wall color customization tool.

## Features

- Image upload and processing
- Wall detection using Facebook's Segment Anything Model (SAM)
- Color application to detected walls
- Preview generation
- Background task processing

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Download SAM model weights:
```bash
wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth -P models/
```

3. Create required directories:
```bash
mkdir -p static/uploads static/processed
```

## Running the Server

Development mode:
```bash
uvicorn app.main:app --reload --port 8000
```

Production mode:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Documentation

Once the server is running, you can access:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### `POST /api/wall/upload`
Upload an image file for wall detection

### `POST /api/wall/detect-walls`
Detect walls in an uploaded image

### `POST /api/wall/apply-color`
Apply color to detected walls

## Environment Variables

Create a `.env` file with the following variables:
```env
# API Settings
PROJECT_NAME="HomeDécor Backend"
API_V1_STR="/api"

# Upload Settings
MAX_UPLOAD_SIZE=10485760  # 10MB
ALLOWED_EXTENSIONS=".jpg,.jpeg,.png"

# Cleanup Settings
CLEANUP_INTERVAL=3600  # 1 hour
MAX_FILE_AGE=86400    # 24 hours