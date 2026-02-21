def normalize_storage_path(path: str) -> str:
    """
    Normalize file path for storage/JSON responses.

    Keep filesystem write/read compatible on Windows while ensuring
    URLs use forward slashes.
    """
    return path.replace("\\", "/")
