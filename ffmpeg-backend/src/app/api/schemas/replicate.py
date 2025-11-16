"""Replicate API schemas for Replicate models."""

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class NanoBananaRequest(BaseModel):
    """Request schema for Nano-Banana model.

    The Nano-Banana model generates stylized images based on a prompt
    and optional image input.
    """

    prompt: str = Field(
        ...,
        description="Text prompt describing the desired style or modifications",
        min_length=1,
        max_length=1000,
        examples=["Make the sheets in the style of the logo. Make the scene natural."]
    )

    image_input: list[HttpUrl] | None = Field(
        default=None,
        description="Optional list of image URLs to use as input",
        max_length=10,
        examples=[["https://example.com/image1.png", "https://example.com/image2.png"]]
    )

    return_s3: bool = Field(
        default=True,
        description="If true, upload to S3 and return S3 URL. If false, return Replicate URL directly.",
        examples=[True, False]
    )


class NanoBananaResponse(BaseModel):
    """Response schema for Nano-Banana model."""

    url: str = Field(
        ...,
        description="S3 URL of the generated output image",
        examples=["https://your-bucket.s3.amazonaws.com/replicate/nano-banana/abc123.png"]
    )

    status: str = Field(
        default="success",
        description="Status of the generation",
        examples=["success"]
    )


class NanoBananaErrorResponse(BaseModel):
    """Error response schema for Nano-Banana model."""

    error: str = Field(
        ...,
        description="Error message describing what went wrong",
        examples=["Failed to generate image: API key not configured"]
    )

    status: str = Field(
        default="error",
        description="Status indicating an error occurred",
        examples=["error"]
    )


# Wan-Video I2V Schemas

class WanVideoI2VRequest(BaseModel):
    """Request schema for Wan-Video I2V model.

    The Wan-Video I2V model generates videos from a single image and text prompt.
    """

    image: HttpUrl = Field(
        ...,
        description="URI of the input image for video generation",
        examples=["https://example.com/input-image.jpg"]
    )

    prompt: str = Field(
        ...,
        description="Text prompt for video generation",
        min_length=1,
        max_length=1000,
        examples=["A person dancing in the sunset"]
    )

    seed: int | None = Field(
        default=None,
        description="Random seed for reproducible generation",
        examples=[42]
    )

    audio: HttpUrl | None = Field(
        default=None,
        description="Audio file URI (wav/mp3, 3-30s, ≤15MB) for voice/music synchronization",
        examples=["https://example.com/audio.mp3"]
    )

    duration: Literal[5, 10] | None = Field(
        default=5,
        description="Duration in seconds",
        examples=[5, 10]
    )

    resolution: Literal["720p", "1080p"] | None = Field(
        default="720p",
        description="Video resolution",
        examples=["720p", "1080p"]
    )

    negative_prompt: str | None = Field(
        default="",
        description="Text to avoid certain elements in the video",
        max_length=500,
        examples=["blurry, low quality"]
    )

    enable_prompt_expansion: bool | None = Field(
        default=True,
        description="Enable prompt optimizer for better results",
        examples=[True, False]
    )

    return_s3: bool = Field(
        default=True,
        description="If true, upload to S3 and return S3 URL. If false, return Replicate URL directly.",
        examples=[True, False]
    )


class WanVideoI2VResponse(BaseModel):
    """Response schema for Wan-Video I2V model."""

    url: str = Field(
        ...,
        description="S3 URL of the generated video",
        examples=["https://your-bucket.s3.amazonaws.com/replicate/wan-video-i2v/abc123.mp4"]
    )

    status: str = Field(
        default="success",
        description="Status of the generation",
        examples=["success"]
    )


class WanVideoI2VErrorResponse(BaseModel):
    """Error response schema for Wan-Video I2V model."""

    error: str = Field(
        ...,
        description="Error message describing what went wrong",
        examples=["Failed to generate video: API key not configured"]
    )

    status: str = Field(
        default="error",
        description="Status indicating an error occurred",
        examples=["error"]
    )
