from typing import Any, Optional

def success_response(data: Any = None, message: str = "Success"):
    """Standardized success response format."""
    return {
        "status": "success",
        "message": message,
        "data": data
    }

def error_response(message: str = "An error occurred", data: Any = None):
    """Standardized error response format."""
    return {
        "status": "error",
        "message": message,
        "data": data
    }