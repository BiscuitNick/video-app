"""Replicate API endpoints for AI generation with async job tracking."""

import json
import logging
import os
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
from workers.redis_pool import get_redis_connection

from ..schemas.replicate import (
    AsyncJobResponse,
    NanoBananaErrorResponse,
    NanoBananaRequest,
    NanoBananaResponse,
    ReplicateWebhookPayload,
    WanVideoRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Replicate API Configuration
REPLICATE_WEBHOOK_SECRET = os.getenv("REPLICATE_WEBHOOK_SECRET", "")
REPLICATE_WEBHOOK_URL = os.getenv("REPLICATE_WEBHOOK_URL", "")  # e.g., "https://yourdomain.com/api/v1/replicate/webhook"


def store_job_metadata(
    job_id: str,
    job_type: str,
    prompt: str,
    model: str,
    **extra_metadata
) -> None:
    """Store job metadata in Redis for tracking.

    Args:
        job_id: Replicate prediction ID
        job_type: Type of generation (image, video, etc.)
        prompt: User prompt
        model: Replicate model identifier
        **extra_metadata: Additional metadata to store
    """
    try:
        redis_conn = get_redis_connection()

        job_data = {
            "job_id": job_id,
            "job_type": job_type,
            "prompt": prompt,
            "model": model,
            "status": "queued",
            "created_at": datetime.now(UTC).isoformat(),
            **extra_metadata
        }

        # Store with 24-hour expiration
        redis_key = f"ai_job:{job_id}"
        redis_conn.setex(redis_key, 86400, json.dumps(job_data))

        logger.info(f"Stored job metadata for {job_id}", extra={"job_type": job_type})

    except Exception as e:
        logger.error(f"Failed to store job metadata: {e}", exc_info=True)


def publish_job_update(
    job_id: str,
    status_value: str,
    progress: int | None = None,
    result_url: str | None = None,
    error: str | None = None
) -> None:
    """Publish job update to Redis pub/sub for WebSocket delivery.

    Args:
        job_id: Job identifier
        status_value: Job status (queued, running, succeeded, failed, canceled)
        progress: Optional progress percentage (0-100)
        result_url: Optional result URL when completed
        error: Optional error message
    """
    try:
        redis_conn = get_redis_connection()

        # Map Replicate statuses to our job statuses
        status_map = {
            "starting": "queued",
            "processing": "running",
            "succeeded": "succeeded",
            "failed": "failed",
            "canceled": "canceled"
        }

        mapped_status = status_map.get(status_value, status_value)

        message = {
            "event": f"job.{mapped_status}",
            "jobId": job_id,
            "jobType": "ai_generation",
            "status": mapped_status,
            "progress": progress,
            "message": f"Job {mapped_status}",
            "timestamp": datetime.now(UTC).isoformat()
        }

        if result_url:
            message["result"] = {"url": result_url}

        if error:
            message["error"] = error

        # Publish to job-specific channel
        channel = f"job:{job_id}"
        redis_conn.publish(channel, json.dumps(message))

        # Also publish to general AI jobs channel for monitoring
        redis_conn.publish("ai_jobs:updates", json.dumps(message))

        logger.info(f"Published job update for {job_id}: {mapped_status}")

    except Exception as e:
        logger.error(f"Failed to publish job update: {e}", exc_info=True)


@router.post(
    "/nano-banana",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate image with Nano-Banana model (Async)",
    description="Start async image generation using Google's Nano-Banana model via Replicate",
    responses={
        202: {
            "description": "Job created successfully",
            "model": AsyncJobResponse,
        },
        503: {
            "description": "Replicate API key not configured",
            "model": NanoBananaErrorResponse,
        },
    },
)
async def generate_nano_banana(request_body: NanoBananaRequest) -> JSONResponse:
    """Generate image using Nano-Banana model (async).

    Creates an async prediction job and returns immediately with a job ID.
    The client should use WebSocket or polling to track job progress.

    Args:
        request_body: Request containing prompt and optional image input

    Returns:
        AsyncJobResponse: Response with job ID for tracking

    Raises:
        HTTPException: If API key is not configured or job creation fails
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
            "Processing Nano-Banana async request",
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
            model_input["image_input"] = [str(url) for url in request_body.image_input]

        # Create async prediction with webhook
        try:
            prediction = replicate.predictions.create(
                model="google/nano-banana",
                input=model_input,
                webhook=REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            # Store job metadata in Redis
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="google/nano-banana",
                generation_type="image"
            )

            # Publish initial job status
            publish_job_update(job_id, "starting")

            logger.info(
                "Nano-Banana async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "status": prediction.status
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Image generation started"
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
                    "error": f"Failed to start image generation: {str(e)}",
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
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate video with Wan Video I2V model (Async)",
    description="Start async video generation using Wan Video I2V model via Replicate",
)
async def generate_wan_video(request_body: WanVideoRequest) -> JSONResponse:
    """Generate video using Wan Video I2V model (async).

    Creates an async prediction job and returns immediately with a job ID.

    Args:
        request_body: Request containing prompt and optional image input

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Wan Video async request",
            extra={
                "prompt": request_body.prompt,
                "has_image_input": request_body.image_input is not None,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input
        model_input = {
            "prompt": request_body.prompt,
        }

        if request_body.image_input:
            model_input["image"] = str(request_body.image_input)

        # Create async prediction
        try:
            # Note: Replace with actual Wan Video model path
            prediction = replicate.predictions.create(
                model="tencent/hunyuan-video",  # Using Hunyuan Video as example
                input=model_input,
                webhook=REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="tencent/hunyuan-video",
                generation_type="video"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Wan Video async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Video generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start video generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Wan Video endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Replicate webhook receiver",
    description="Receives status updates from Replicate for async predictions",
)
async def replicate_webhook(request: Request) -> JSONResponse:
    """Receive webhook callbacks from Replicate.

    When a prediction completes, Replicate sends a POST request to this endpoint.
    We then publish the result to Redis for WebSocket delivery.

    Args:
        request: FastAPI request object containing webhook payload

    Returns:
        JSONResponse: Acknowledgment response
    """
    try:
        # Parse webhook payload
        payload_dict = await request.json()
        payload = ReplicateWebhookPayload(**payload_dict)

        logger.info(
            f"Received Replicate webhook for job {payload.id}",
            extra={
                "job_id": payload.id,
                "status": payload.status
            }
        )

        # Extract result URL
        result_url = None
        if payload.output:
            if isinstance(payload.output, str):
                result_url = payload.output
            elif isinstance(payload.output, list) and len(payload.output) > 0:
                result_url = payload.output[0]

        # Publish job update based on status
        if payload.status == "succeeded":
            publish_job_update(
                job_id=payload.id,
                status_value="succeeded",
                progress=100,
                result_url=result_url
            )
        elif payload.status == "failed":
            publish_job_update(
                job_id=payload.id,
                status_value="failed",
                error=payload.error or "Generation failed"
            )
        elif payload.status == "canceled":
            publish_job_update(
                job_id=payload.id,
                status_value="canceled"
            )

        # Update job metadata in Redis
        try:
            redis_conn = get_redis_connection()
            redis_key = f"ai_job:{payload.id}"

            job_data_str = redis_conn.get(redis_key)
            if job_data_str:
                job_data = json.loads(job_data_str)
                job_data["status"] = payload.status
                job_data["updated_at"] = datetime.now(UTC).isoformat()

                if result_url:
                    job_data["result_url"] = result_url
                if payload.error:
                    job_data["error"] = payload.error

                redis_conn.setex(redis_key, 86400, json.dumps(job_data))

        except Exception as e:
            logger.warning(f"Failed to update job metadata: {e}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ok", "job_id": payload.id}
        )

    except Exception as e:
        logger.exception("Failed to process webhook", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(e)}
        )
