"""Replicate API endpoints for AI image generation."""

import logging
import os
import tempfile
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from workers.s3_manager import s3_manager

from ..schemas.replicate import (
    NanoBananaErrorResponse,
    NanoBananaRequest,
    NanoBananaResponse,
    WanVideoI2VErrorResponse,
    WanVideoI2VRequest,
    WanVideoI2VResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/nano-banana",
    response_model=NanoBananaResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate image with Nano-Banana model",
    description="Generate stylized image using Google's Nano-Banana model via Replicate. Optionally save to S3 or return Replicate URL.",
    responses={
        200: {
            "description": "Successfully generated image (uploaded to S3 if return_s3=true)",
            "model": NanoBananaResponse,
        },
        400: {
            "description": "Invalid request parameters",
            "model": NanoBananaErrorResponse,
        },
        500: {
            "description": "Internal server error or Replicate API error",
            "model": NanoBananaErrorResponse,
        },
        503: {
            "description": "Replicate API key not configured",
            "model": NanoBananaErrorResponse,
        },
    },
)
async def generate_nano_banana(request_body: NanoBananaRequest) -> JSONResponse:
    """Generate image using Nano-Banana model.

    This endpoint accepts a text prompt and optional image input URLs,
    and uses the Replicate API to generate a stylized image.

    If return_s3 is True (default), downloads the image and uploads it to S3.
    If return_s3 is False, returns the Replicate URL directly.

    Args:
        request_body: Request containing prompt, optional image input, and return_s3 flag

    Returns:
        NanoBananaResponse: Response with S3 URL (if return_s3=True) or Replicate URL (if return_s3=False)

    Raises:
        HTTPException: If API key is not configured or generation fails
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured. Please set REPLICATE_API_TOKEN environment variable.",
                    "status": "error",
                },
            )

        # Import Replicate here to avoid import errors if package not installed
        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed. Please run: pip install replicate",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Nano-Banana request",
            extra={
                "prompt": request_body.prompt,
                "has_image_input": request_body.image_input is not None,
                "image_count": len(request_body.image_input) if request_body.image_input else 0,
            },
        )

        # Set API token for replicate
        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for the model
        model_input = {
            "prompt": request_body.prompt,
        }

        # Add image input if provided
        if request_body.image_input:
            # Convert HttpUrl objects to strings
            model_input["image_input"] = [str(url) for url in request_body.image_input]

        # Run the Nano-Banana model
        try:
            output = replicate.run(
                "google/nano-banana",
                input=model_input,
            )

            # Get the output URL from Replicate
            # The output is typically a string URL or a FileOutput object
            if isinstance(output, str):
                replicate_url = output
            elif hasattr(output, "url"):
                # If it's a file object with url attribute (not method)
                replicate_url = output.url if isinstance(output.url, str) else str(output.url)
            else:
                # Convert to string as fallback
                replicate_url = str(output)

            logger.info(
                "Nano-Banana generation successful",
                extra={
                    "replicate_url": replicate_url,
                    "prompt": request_body.prompt,
                    "return_s3": request_body.return_s3,
                },
            )

            # If return_s3 is False, return the Replicate URL directly
            if not request_body.return_s3:
                logger.info(
                    "Returning Replicate URL directly (return_s3=False)",
                    extra={"replicate_url": replicate_url},
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "url": replicate_url,
                        "status": "success",
                    },
                )

            # Download the image from Replicate URL and upload to S3
            try:
                # Generate unique filename
                image_id = uuid.uuid4()
                file_extension = ".png"  # Nano-Banana typically outputs PNG

                # Determine file extension from URL if possible
                if "." in replicate_url.split("/")[-1]:
                    file_extension = "." + replicate_url.split(".")[-1].split("?")[0]

                temp_filename = f"{image_id}{file_extension}"
                s3_key = f"replicate/nano-banana/{image_id}{file_extension}"

                # Download image from Replicate URL to temp file
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_path = Path(temp_dir) / temp_filename

                    logger.debug(
                        "Downloading image from Replicate",
                        extra={"url": replicate_url, "temp_path": str(temp_path)},
                    )

                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.get(replicate_url)
                        response.raise_for_status()

                        # Write image data to temp file
                        temp_path.write_bytes(response.content)

                    logger.debug(
                        "Image downloaded, uploading to S3",
                        extra={"size_bytes": len(response.content), "s3_key": s3_key},
                    )

                    # Upload to S3
                    s3_url = s3_manager.upload_file(
                        local_path=temp_path,
                        s3_key=s3_key,
                        extra_args={
                            "ContentType": response.headers.get("content-type", "image/png"),
                            "Metadata": {
                                "source": "replicate-nano-banana",
                                "prompt": request_body.prompt[:100],  # Limit metadata size
                            },
                        },
                    )

                logger.info(
                    "Image uploaded to S3 successfully",
                    extra={
                        "s3_url": s3_url,
                        "s3_key": s3_key,
                        "prompt": request_body.prompt,
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "url": s3_url,
                        "status": "success",
                    },
                )

            except httpx.HTTPError as e:
                logger.exception(
                    "Failed to download image from Replicate",
                    extra={
                        "replicate_url": replicate_url,
                        "error": str(e),
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "error": f"Failed to download image from Replicate: {str(e)}",
                        "status": "error",
                    },
                )

            except Exception as e:
                logger.exception(
                    "Failed to upload image to S3",
                    extra={
                        "s3_key": s3_key,
                        "error": str(e),
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "error": f"Failed to upload image to S3: {str(e)}",
                        "status": "error",
                    },
                )

        except Exception as e:
            logger.exception(
                "Replicate API call failed",
                extra={
                    "error": str(e),
                    "prompt": request_body.prompt,
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to generate image: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception(
            "Unexpected error in Nano-Banana endpoint",
            extra={"error": str(e)},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/wan-video-i2v",
    response_model=WanVideoI2VResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate video from image with Wan-Video I2V model",
    description="Generate video from a single image using Wan-Video I2V model via Replicate. Optionally save to S3 or return Replicate URL.",
    responses={
        200: {
            "description": "Successfully generated video (uploaded to S3 if return_s3=true)",
            "model": WanVideoI2VResponse,
        },
        400: {
            "description": "Invalid request parameters",
            "model": WanVideoI2VErrorResponse,
        },
        500: {
            "description": "Internal server error or Replicate API error",
            "model": WanVideoI2VErrorResponse,
        },
        503: {
            "description": "Replicate API key not configured",
            "model": WanVideoI2VErrorResponse,
        },
    },
)
async def generate_wan_video_i2v(request_body: WanVideoI2VRequest) -> JSONResponse:
    """Generate video from image using Wan-Video I2V model.

    This endpoint accepts an image URL and text prompt, and uses the Replicate API
    to generate a video.

    If return_s3 is True (default), downloads the video and uploads it to S3.
    If return_s3 is False, returns the Replicate URL directly.

    Args:
        request_body: Request containing image, prompt, optional parameters, and return_s3 flag

    Returns:
        WanVideoI2VResponse: Response with S3 URL (if return_s3=True) or Replicate URL (if return_s3=False)

    Raises:
        HTTPException: If API key is not configured or generation fails
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured. Please set REPLICATE_API_TOKEN environment variable.",
                    "status": "error",
                },
            )

        # Import Replicate here to avoid import errors if package not installed
        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed. Please run: pip install replicate",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Wan-Video I2V request",
            extra={
                "image": str(request_body.image),
                "prompt": request_body.prompt,
                "duration": request_body.duration,
                "resolution": request_body.resolution,
            },
        )

        # Set API token for replicate
        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for the model
        model_input = {
            "image": str(request_body.image),
            "prompt": request_body.prompt,
        }

        # Add optional parameters if provided
        if request_body.seed is not None:
            model_input["seed"] = request_body.seed
        if request_body.audio is not None:
            model_input["audio"] = str(request_body.audio)
        if request_body.duration is not None:
            model_input["duration"] = request_body.duration
        if request_body.resolution is not None:
            model_input["resolution"] = request_body.resolution
        if request_body.negative_prompt:
            model_input["negative_prompt"] = request_body.negative_prompt
        if request_body.enable_prompt_expansion is not None:
            model_input["enable_prompt_expansion"] = request_body.enable_prompt_expansion

        # Run the Wan-Video I2V model
        try:
            output = replicate.run(
                "wan-video/wan-2.5-i2v-fast",
                input=model_input,
            )

            # Get the output URL from Replicate
            # The output is typically a string URL or a FileOutput object
            if isinstance(output, str):
                replicate_url = output
            elif hasattr(output, "url"):
                # If it's a file object with url attribute (not method)
                replicate_url = output.url if isinstance(output.url, str) else str(output.url)
            else:
                # Convert to string as fallback
                replicate_url = str(output)

            logger.info(
                "Wan-Video I2V generation successful",
                extra={
                    "replicate_url": replicate_url,
                    "prompt": request_body.prompt,
                    "return_s3": request_body.return_s3,
                },
            )

            # If return_s3 is False, return the Replicate URL directly
            if not request_body.return_s3:
                logger.info(
                    "Returning Replicate URL directly (return_s3=False)",
                    extra={"replicate_url": replicate_url},
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "url": replicate_url,
                        "status": "success",
                    },
                )

            # Download the video from Replicate URL and upload to S3
            try:
                # Generate unique filename
                video_id = uuid.uuid4()
                file_extension = ".mp4"  # Wan-Video I2V outputs MP4

                # Determine file extension from URL if possible
                if "." in replicate_url.split("/")[-1]:
                    file_extension = "." + replicate_url.split(".")[-1].split("?")[0]

                temp_filename = f"{video_id}{file_extension}"
                s3_key = f"replicate/wan-video-i2v/{video_id}{file_extension}"

                # Download video from Replicate URL to temp file
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_path = Path(temp_dir) / temp_filename

                    logger.debug(
                        "Downloading video from Replicate",
                        extra={"url": replicate_url, "temp_path": str(temp_path)},
                    )

                    async with httpx.AsyncClient(timeout=300.0) as client:  # 5 min timeout for video
                        response = await client.get(replicate_url)
                        response.raise_for_status()

                        # Write video data to temp file
                        temp_path.write_bytes(response.content)

                    logger.debug(
                        "Video downloaded, uploading to S3",
                        extra={"size_bytes": len(response.content), "s3_key": s3_key},
                    )

                    # Upload to S3
                    s3_url = s3_manager.upload_file(
                        local_path=temp_path,
                        s3_key=s3_key,
                        extra_args={
                            "ContentType": response.headers.get("content-type", "video/mp4"),
                            "Metadata": {
                                "source": "replicate-wan-video-i2v",
                                "prompt": request_body.prompt[:100],  # Limit metadata size
                                "duration": str(request_body.duration or 5),
                                "resolution": request_body.resolution or "720p",
                            },
                        },
                    )

                logger.info(
                    "Video uploaded to S3 successfully",
                    extra={
                        "s3_url": s3_url,
                        "s3_key": s3_key,
                        "prompt": request_body.prompt,
                    },
                )

                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "url": s3_url,
                        "status": "success",
                    },
                )

            except httpx.HTTPError as e:
                logger.exception(
                    "Failed to download video from Replicate",
                    extra={
                        "replicate_url": replicate_url,
                        "error": str(e),
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "error": f"Failed to download video from Replicate: {str(e)}",
                        "status": "error",
                    },
                )

            except Exception as e:
                logger.exception(
                    "Failed to upload video to S3",
                    extra={
                        "s3_key": s3_key,
                        "error": str(e),
                    },
                )
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "error": f"Failed to upload video to S3: {str(e)}",
                        "status": "error",
                    },
                )

        except Exception as e:
            logger.exception(
                "Replicate API call failed",
                extra={
                    "error": str(e),
                    "prompt": request_body.prompt,
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to generate video: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception(
            "Unexpected error in Wan-Video I2V endpoint",
            extra={"error": str(e)},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )
