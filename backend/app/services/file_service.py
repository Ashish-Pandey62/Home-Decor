import shutil
import aiofiles
import uuid
import os
from pathlib import Path
from fastapi import UploadFile
from datetime import datetime, timedelta
from ..core.config import settings, logger
from ..core.exceptions import StorageError, FileSizeLimitExceeded, InvalidFileType

class FileService:
    @staticmethod
    async def save_upload(file: UploadFile) -> tuple[str, Path]:
        """
        Save an uploaded file and return its ID and path
        """
        try:
            # Validate file size
            file.file.seek(0, 2)  # Seek to end
            size = file.file.tell()
            file.file.seek(0)  # Reset to start
            
            if size > settings.MAX_UPLOAD_SIZE:
                raise FileSizeLimitExceeded(
                    f"File size {size} exceeds maximum of {settings.MAX_UPLOAD_SIZE}"
                )

            # Validate file type
            ext = Path(file.filename).suffix.lower()
            if ext not in settings.ALLOWED_EXTENSIONS:
                raise InvalidFileType(
                    f"File type {ext} not allowed. Allowed types: {settings.ALLOWED_EXTENSIONS}"
                )

            # Generate unique filename
            file_id = str(uuid.uuid4())
            filename = f"{file_id}{ext}"
            file_path = settings.UPLOAD_DIR / filename

            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                while content := await file.read(1024 * 1024):  # Read in 1MB chunks
                    await f.write(content)

            return file_id, file_path

        except (FileSizeLimitExceeded, InvalidFileType) as e:
            raise e
        except Exception as e:
            raise StorageError(f"Error saving file: {str(e)}")

    @staticmethod
    def save_processed_image(image_id: str, image_data: bytes, suffix: str = "") -> Path:
        """
        Save a processed image and return its path
        """
        try:
            # Ensure processed directory exists
            settings.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
            
            filename = f"{image_id}{suffix}.jpg"
            file_path = settings.PROCESSED_DIR / filename
            
            # Create parent directories if they don't exist
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Check directory permissions
            if not os.access(str(file_path.parent), os.W_OK):
                raise StorageError(f"No write permission for directory: {file_path.parent}")
            
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            # Verify file was created
            if not file_path.exists():
                raise StorageError(f"Failed to create file: {file_path}")
            
            return file_path

        except Exception as e:
            logger.error(f"Error saving processed image {image_id}: {str(e)}", exc_info=True)
            raise StorageError(f"Error saving processed image: {str(e)}")

    @staticmethod
    async def cleanup_old_files(max_age: int = None):
        """
        Remove files older than max_age seconds
        """
        if max_age is None:
            max_age = settings.MAX_FILE_AGE

        current_time = datetime.now()
        threshold = current_time - timedelta(seconds=max_age)

        # Cleanup uploads directory
        for file_path in settings.UPLOAD_DIR.glob('*'):
            if file_path.is_file():
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < threshold:
                    try:
                        file_path.unlink()
                    except Exception as e:
                        print(f"Error removing file {file_path}: {e}")

        # Cleanup processed directory
        for file_path in settings.PROCESSED_DIR.glob('*'):
            if file_path.is_file():
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < threshold:
                    try:
                        file_path.unlink()
                    except Exception as e:
                        print(f"Error removing file {file_path}: {e}")

    @staticmethod
    def get_file_path(image_id: str) -> Path:
        """
        Get the file path for a given image ID
        """
        for ext in settings.ALLOWED_EXTENSIONS:
            file_path = settings.UPLOAD_DIR / f"{image_id}{ext}"
            if file_path.exists():
                return file_path
        raise StorageError(f"No file found for image ID: {image_id}")

    @staticmethod
    def get_file_url(file_path: Path) -> str:
        """
        Convert a file path to a URL path
        """
        relative_path = file_path.relative_to(settings.BASE_DIR)
        return str(relative_path).replace('\\', '/')