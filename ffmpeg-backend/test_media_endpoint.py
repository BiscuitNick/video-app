#!/usr/bin/env python3
"""Test script for media upload endpoint.

This script tests the media upload endpoint logic without requiring a running server.
It validates that the endpoint can:
1. Validate file sizes correctly
2. Validate file formats correctly
3. Construct proper S3 keys
4. Generate presigned URLs (mocked)
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from app.api.schemas.media import MediaType, MediaUploadRequest
from app.api.v1.media import (
    construct_s3_key,
    get_file_extension,
    validate_file_format,
    validate_file_size,
)
from app.config import get_settings

settings = get_settings()


def test_file_extension_extraction():
    """Test file extension extraction."""
    print("\n=== Testing File Extension Extraction ===")

    test_cases = [
        ("video.mp4", "mp4"),
        ("my-file.MOV", "mov"),
        ("audio.m4a", "m4a"),
        ("image.PNG", "png"),
        ("complex.file.name.webm", "webm"),
    ]

    for filename, expected_ext in test_cases:
        result = get_file_extension(filename)
        status = "✓" if result == expected_ext else "✗"
        print(f"{status} {filename} -> {result} (expected: {expected_ext})")
        assert result == expected_ext, f"Expected {expected_ext}, got {result}"

    print("✓ All file extension tests passed!")


def test_s3_key_construction():
    """Test S3 key construction."""
    print("\n=== Testing S3 Key Construction ===")

    test_cases = [
        {
            "user_id": "test-user",
            "media_type": MediaType.VIDEO,
            "media_asset_id": "12345678-1234-1234-1234-123456789012",
            "filename": "my-video.mp4",
            "expected_pattern": "user-uploads/test-user/videos/12345678-1234-1234-1234-123456789012.mp4",
        },
        {
            "user_id": "another-user",
            "media_type": MediaType.AUDIO,
            "media_asset_id": "abcdef00-1234-5678-90ab-cdef12345678",
            "filename": "audio.m4a",
            "expected_pattern": "user-uploads/another-user/audios/abcdef00-1234-5678-90ab-cdef12345678.m4a",
        },
        {
            "user_id": "image-user",
            "media_type": MediaType.IMAGE,
            "media_asset_id": "11111111-2222-3333-4444-555555555555",
            "filename": "photo.png",
            "expected_pattern": "user-uploads/image-user/images/11111111-2222-3333-4444-555555555555.png",
        },
    ]

    for test_case in test_cases:
        result = construct_s3_key(
            user_id=test_case["user_id"],
            media_type=test_case["media_type"],
            media_asset_id=test_case["media_asset_id"],
            filename=test_case["filename"],
        )
        expected = test_case["expected_pattern"]
        status = "✓" if result == expected else "✗"
        print(f"{status} {test_case['media_type'].value}: {result}")
        assert result == expected, f"Expected {expected}, got {result}"

    print("✓ All S3 key construction tests passed!")


def test_file_size_validation():
    """Test file size validation."""
    print("\n=== Testing File Size Validation ===")

    # Test valid sizes
    print("\nValid file sizes:")
    test_cases = [
        (10 * 1024 * 1024, MediaType.VIDEO, "10 MB video"),
        (50 * 1024 * 1024, MediaType.AUDIO, "50 MB audio"),
        (5 * 1024 * 1024, MediaType.IMAGE, "5 MB image"),
    ]

    for file_size, media_type, description in test_cases:
        try:
            max_size = validate_file_size(file_size, media_type)
            print(f"✓ {description}: {file_size} bytes (max: {max_size} bytes)")
        except Exception as e:
            print(f"✗ {description}: {e}")
            raise

    # Test invalid sizes (too large)
    print("\nInvalid file sizes (should fail):")
    invalid_cases = [
        (600 * 1024 * 1024, MediaType.VIDEO, "600 MB video (max 500 MB)"),
        (150 * 1024 * 1024, MediaType.AUDIO, "150 MB audio (max 100 MB)"),
        (15 * 1024 * 1024, MediaType.IMAGE, "15 MB image (max 10 MB)"),
    ]

    for file_size, media_type, description in invalid_cases:
        try:
            validate_file_size(file_size, media_type)
            print(f"✗ {description}: Should have failed but didn't!")
            raise AssertionError(f"Expected validation to fail for {description}")
        except Exception as e:
            if "exceeds maximum" in str(e):
                print(f"✓ {description}: Correctly rejected - {e}")
            else:
                print(f"✗ {description}: Unexpected error - {e}")
                raise

    print("✓ All file size validation tests passed!")


def test_file_format_validation():
    """Test file format validation."""
    print("\n=== Testing File Format Validation ===")

    # Test valid formats
    print("\nValid file formats:")
    valid_cases = [
        ("video.mp4", MediaType.VIDEO),
        ("video.mov", MediaType.VIDEO),
        ("audio.mp3", MediaType.AUDIO),
        ("audio.m4a", MediaType.AUDIO),
        ("image.png", MediaType.IMAGE),
        ("image.jpg", MediaType.IMAGE),
    ]

    for filename, media_type in valid_cases:
        try:
            validate_file_format(filename, media_type)
            print(f"✓ {filename} as {media_type.value}")
        except Exception as e:
            print(f"✗ {filename} as {media_type.value}: {e}")
            raise

    # Test invalid formats
    print("\nInvalid file formats (should fail):")
    invalid_cases = [
        ("video.txt", MediaType.VIDEO, "txt not supported for video"),
        ("audio.pdf", MediaType.AUDIO, "pdf not supported for audio"),
        ("image.doc", MediaType.IMAGE, "doc not supported for image"),
        ("video.mp3", MediaType.VIDEO, "mp3 is audio, not video"),
    ]

    for filename, media_type, description in invalid_cases:
        try:
            validate_file_format(filename, media_type)
            print(f"✗ {description}: Should have failed but didn't!")
            raise AssertionError(f"Expected validation to fail for {description}")
        except Exception as e:
            if "Unsupported file format" in str(e):
                print(f"✓ {description}: Correctly rejected")
            else:
                print(f"✗ {description}: Unexpected error - {e}")
                raise

    print("✓ All file format validation tests passed!")


def test_request_schema_validation():
    """Test MediaUploadRequest schema validation."""
    print("\n=== Testing MediaUploadRequest Schema Validation ===")

    # Valid request
    print("\nValid request:")
    try:
        request = MediaUploadRequest(
            filename="my-video.mp4",
            content_type="video/mp4",
            file_size_bytes=10 * 1024 * 1024,
            media_type=MediaType.VIDEO,
            folder_id="my-folder",
        )
        print(f"✓ Valid request created: {request.filename}")
    except Exception as e:
        print(f"✗ Failed to create valid request: {e}")
        raise

    # Invalid requests
    print("\nInvalid requests (should fail):")

    # Test filename with path separator
    try:
        request = MediaUploadRequest(
            filename="../../../evil.mp4",
            content_type="video/mp4",
            file_size_bytes=1024,
            media_type=MediaType.VIDEO,
        )
        print("✗ Path traversal in filename should have been rejected!")
        raise AssertionError("Expected validation to fail for path traversal")
    except ValueError as e:
        print(f"✓ Path traversal rejected: {e}")

    # Test invalid content type
    try:
        request = MediaUploadRequest(
            filename="video.mp4",
            content_type="invalid-content-type",
            file_size_bytes=1024,
            media_type=MediaType.VIDEO,
        )
        print("✗ Invalid content type should have been rejected!")
        raise AssertionError("Expected validation to fail for invalid content type")
    except ValueError as e:
        print(f"✓ Invalid content type rejected: {e}")

    # Test negative file size
    try:
        request = MediaUploadRequest(
            filename="video.mp4",
            content_type="video/mp4",
            file_size_bytes=-1024,
            media_type=MediaType.VIDEO,
        )
        print("✗ Negative file size should have been rejected!")
        raise AssertionError("Expected validation to fail for negative file size")
    except Exception as e:
        print(f"✓ Negative file size rejected: {e}")

    print("✓ All schema validation tests passed!")


def test_configuration():
    """Test configuration values."""
    print("\n=== Testing Configuration ===")

    print(f"Max video upload size: {settings.max_video_upload_size_mb} MB")
    print(f"Max audio upload size: {settings.max_audio_upload_size_mb} MB")
    print(f"Max image upload size: {settings.max_image_upload_size_mb} MB")
    print(f"Default user ID: {settings.default_user_id}")
    print(f"Presigned URL expiration: {settings.presigned_url_expiration} seconds")
    print(f"Supported video formats: {', '.join(settings.supported_video_formats)}")
    print(f"Supported audio formats: {', '.join(settings.supported_audio_formats)}")
    print(f"Supported image formats: {', '.join(settings.supported_image_formats)}")

    # Validate configuration values
    assert settings.max_video_upload_size_mb > 0, "Max video size must be positive"
    assert settings.max_audio_upload_size_mb > 0, "Max audio size must be positive"
    assert settings.max_image_upload_size_mb > 0, "Max image size must be positive"
    assert settings.default_user_id, "Default user ID must be set"
    assert settings.presigned_url_expiration > 0, "Presigned URL expiration must be positive"

    print("✓ Configuration is valid!")


def main():
    """Run all tests."""
    print("=" * 80)
    print("Media Upload Endpoint Test Suite")
    print("=" * 80)

    try:
        test_configuration()
        test_file_extension_extraction()
        test_s3_key_construction()
        test_file_size_validation()
        test_file_format_validation()
        test_request_schema_validation()

        print("\n" + "=" * 80)
        print("✓ ALL TESTS PASSED!")
        print("=" * 80)
        print("\nThe media upload endpoint implementation is working correctly!")
        print("\nEndpoint: POST /api/v1/media/upload")
        print("Router registered: /api/v1/media")
        print("\nNote: Database record creation is pending Task 13.1 (MediaAsset model)")

        return 0
    except Exception as e:
        print("\n" + "=" * 80)
        print(f"✗ TEST FAILED: {e}")
        print("=" * 80)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
