from fastapi import HTTPException, status

class BaseCustomException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=self.status_code, detail=detail)

class ImageProcessingError(BaseCustomException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY

class InvalidImageError(BaseCustomException):
    status_code = status.HTTP_400_BAD_REQUEST

class StorageError(BaseCustomException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

class ModelError(BaseCustomException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

class FileNotFoundError(BaseCustomException):
    status_code = status.HTTP_404_NOT_FOUND

class FileSizeLimitExceeded(BaseCustomException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE

class InvalidFileType(BaseCustomException):
    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE