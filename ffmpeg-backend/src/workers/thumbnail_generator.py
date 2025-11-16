"""Thumbnail generation for video and image assets using FFmpeg and Pillow."""

import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import settings
from PIL import Image

logger = logging.getLogger(__name__)


@dataclass
class ThumbnailSize:
    """Thumbnail size configuration."""

    name: str
    width: int
    height: int

    @property
    def dimensions(self) -> str:
        """Get dimensions as WxH string.

        Returns:
            str: Dimensions in WxH format
        """
        return f"{self.width}x{self.height}"


# Thumbnail sizes to generate
THUMBNAIL_SIZES = [
    ThumbnailSize(name="small", width=150, height=150),
    ThumbnailSize(name="medium", width=300, height=300),
    ThumbnailSize(name="large", width=600, height=600),
]


class ThumbnailGenerator:
    """Generate thumbnails for video and image assets."""

    def __init__(self, temp_dir: Path | None = None) -> None:
        """Initialize thumbnail generator.

        Args:
            temp_dir: Temporary directory for processing (defaults to settings.temp_dir)
        """
        self.temp_dir = Path(temp_dir) if temp_dir else Path(settings.temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.ffmpeg_path = settings.ffmpeg_path
        self.ffprobe_path = settings.ffprobe_path

        logger.info(
            "Initialized ThumbnailGenerator",
            extra={"temp_dir": str(self.temp_dir)},
        )

    def generate_video_thumbnail(
        self,
        video_path: Path,
        output_path: Path,
        timestamp: float = 1.0,
        width: int = 300,
        height: int = 300,
    ) -> Path:
        """Generate a thumbnail from a video file using FFmpeg.

        Args:
            video_path: Path to video file
            output_path: Path to save thumbnail
            timestamp: Timestamp in seconds to extract frame (default: 1.0)
            width: Thumbnail width in pixels
            height: Thumbnail height in pixels

        Returns:
            Path: Path to generated thumbnail

        Raises:
            RuntimeError: If FFmpeg fails to generate thumbnail
        """
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Get video duration to ensure timestamp is valid
        duration = self._get_video_duration(video_path)

        # Adjust timestamp if it exceeds video duration
        if timestamp >= duration:
            timestamp = max(0, duration / 2)  # Use middle of video

        logger.info(
            f"Generating video thumbnail at {timestamp}s",
            extra={
                "video": str(video_path),
                "output": str(output_path),
                "timestamp": timestamp,
                "size": f"{width}x{height}",
            },
        )

        # FFmpeg command to extract frame and resize
        cmd = [
            self.ffmpeg_path,
            "-y",  # Overwrite output
            "-ss",
            str(timestamp),  # Seek to timestamp
            "-i",
            str(video_path),
            "-vframes",
            "1",  # Extract 1 frame
            "-vf",
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            "-q:v",
            "2",  # High quality JPEG
            str(output_path),
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            )

            if not output_path.exists():
                raise RuntimeError(f"FFmpeg completed but thumbnail not found: {output_path}")

            logger.info(
                f"Video thumbnail generated successfully",
                extra={
                    "output": str(output_path),
                    "size_bytes": output_path.stat().st_size,
                },
            )

            return output_path

        except subprocess.CalledProcessError as e:
            error_msg = f"FFmpeg failed to generate thumbnail: {e.stderr}"
            logger.error(error_msg, extra={"video": str(video_path), "stderr": e.stderr})
            raise RuntimeError(error_msg) from e

        except subprocess.TimeoutExpired as e:
            error_msg = "FFmpeg thumbnail generation timed out after 30 seconds"
            logger.error(error_msg, extra={"video": str(video_path)})
            raise RuntimeError(error_msg) from e

    def generate_video_thumbnail_smart(
        self,
        video_path: Path,
        output_path: Path,
        width: int = 300,
        height: int = 300,
        num_candidates: int = 5,
    ) -> Path:
        """Generate a thumbnail from a video using smart frame selection.

        Extracts multiple candidate frames and selects the one with the best
        histogram distribution (avoiding black/blank frames).

        Args:
            video_path: Path to video file
            output_path: Path to save thumbnail
            width: Thumbnail width in pixels
            height: Thumbnail height in pixels
            num_candidates: Number of candidate frames to evaluate (default: 5)

        Returns:
            Path: Path to generated thumbnail

        Raises:
            RuntimeError: If thumbnail generation fails
        """
        logger.info(
            f"Generating smart video thumbnail with {num_candidates} candidates",
            extra={"video": str(video_path), "output": str(output_path)},
        )

        # Get video duration
        duration = self._get_video_duration(video_path)

        # Generate candidate timestamps (evenly distributed, avoiding first/last 10%)
        start_offset = duration * 0.1
        end_offset = duration * 0.9
        usable_duration = end_offset - start_offset

        if usable_duration <= 0:
            # Video too short, just use 1 second or middle
            timestamps = [min(1.0, duration / 2)]
        else:
            # Generate evenly spaced timestamps
            timestamps = [
                start_offset + (usable_duration * i / (num_candidates - 1))
                for i in range(num_candidates)
            ]

        # Extract candidate frames
        candidate_paths = []
        temp_dir = self.temp_dir / f"thumb_candidates_{video_path.stem}"
        temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            for i, timestamp in enumerate(timestamps):
                candidate_path = temp_dir / f"candidate_{i}.jpg"
                try:
                    self.generate_video_thumbnail(
                        video_path=video_path,
                        output_path=candidate_path,
                        timestamp=timestamp,
                        width=width,
                        height=height,
                    )
                    candidate_paths.append(candidate_path)
                except Exception as e:
                    logger.warning(
                        f"Failed to generate candidate {i} at {timestamp}s: {e}",
                        extra={"timestamp": timestamp, "error": str(e)},
                    )

            if not candidate_paths:
                raise RuntimeError("Failed to generate any candidate frames")

            # Select best frame based on histogram analysis
            best_frame = self._select_best_frame(candidate_paths)

            # Copy best frame to output location
            output_path.parent.mkdir(parents=True, exist_ok=True)
            best_frame.replace(output_path)

            logger.info(
                f"Smart thumbnail generation complete",
                extra={
                    "output": str(output_path),
                    "candidates_evaluated": len(candidate_paths),
                },
            )

            return output_path

        finally:
            # Cleanup candidate files
            try:
                import shutil

                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Failed to cleanup candidate directory: {e}")

    def generate_image_thumbnail(
        self,
        image_path: Path,
        output_path: Path,
        width: int = 300,
        height: int = 300,
    ) -> Path:
        """Generate a thumbnail from an image file using Pillow.

        Args:
            image_path: Path to image file
            output_path: Path to save thumbnail
            width: Thumbnail width in pixels
            height: Thumbnail height in pixels

        Returns:
            Path: Path to generated thumbnail

        Raises:
            RuntimeError: If thumbnail generation fails
        """
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(
            f"Generating image thumbnail",
            extra={
                "image": str(image_path),
                "output": str(output_path),
                "size": f"{width}x{height}",
            },
        )

        try:
            # Open image
            with Image.open(image_path) as img:
                # Convert RGBA to RGB if necessary
                if img.mode in ("RGBA", "LA", "P"):
                    # Create white background
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Calculate dimensions to maintain aspect ratio
                img_width, img_height = img.size
                aspect_ratio = img_width / img_height
                target_aspect = width / height

                if aspect_ratio > target_aspect:
                    # Image is wider - fit to width
                    new_width = width
                    new_height = int(width / aspect_ratio)
                else:
                    # Image is taller - fit to height
                    new_height = height
                    new_width = int(height * aspect_ratio)

                # Resize image with high-quality resampling
                img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                # Create canvas with padding to exact size
                canvas = Image.new("RGB", (width, height), (0, 0, 0))
                x_offset = (width - new_width) // 2
                y_offset = (height - new_height) // 2
                canvas.paste(img_resized, (x_offset, y_offset))

                # Save thumbnail
                canvas.save(output_path, "JPEG", quality=90, optimize=True)

            logger.info(
                f"Image thumbnail generated successfully",
                extra={
                    "output": str(output_path),
                    "size_bytes": output_path.stat().st_size,
                },
            )

            return output_path

        except Exception as e:
            error_msg = f"Failed to generate image thumbnail: {e}"
            logger.exception(error_msg, extra={"image": str(image_path)})
            raise RuntimeError(error_msg) from e

    def generate_thumbnails(
        self,
        source_path: Path,
        asset_id: str,
        media_type: str,
        use_smart_selection: bool = True,
    ) -> dict[str, Path]:
        """Generate thumbnails in all configured sizes.

        Args:
            source_path: Path to source media file
            asset_id: Asset ID for organizing thumbnails
            media_type: Type of media ('video' or 'image')
            use_smart_selection: Use smart frame selection for videos (default: True)

        Returns:
            dict: Mapping of size name to thumbnail path

        Raises:
            RuntimeError: If thumbnail generation fails
        """
        logger.info(
            f"Generating thumbnails for {media_type} asset {asset_id}",
            extra={
                "source": str(source_path),
                "asset_id": asset_id,
                "media_type": media_type,
                "num_sizes": len(THUMBNAIL_SIZES),
            },
        )

        thumbnails = {}

        for size in THUMBNAIL_SIZES:
            # Create output path
            output_filename = f"thumb_{size.name}.jpg"
            output_path = self.temp_dir / asset_id / output_filename

            try:
                if media_type == "video":
                    if use_smart_selection:
                        thumbnail_path = self.generate_video_thumbnail_smart(
                            video_path=source_path,
                            output_path=output_path,
                            width=size.width,
                            height=size.height,
                        )
                    else:
                        thumbnail_path = self.generate_video_thumbnail(
                            video_path=source_path,
                            output_path=output_path,
                            timestamp=1.0,
                            width=size.width,
                            height=size.height,
                        )
                elif media_type == "image":
                    thumbnail_path = self.generate_image_thumbnail(
                        image_path=source_path,
                        output_path=output_path,
                        width=size.width,
                        height=size.height,
                    )
                else:
                    raise ValueError(f"Unsupported media type: {media_type}")

                thumbnails[size.name] = thumbnail_path

                logger.debug(
                    f"Generated {size.name} thumbnail",
                    extra={"size": size.dimensions, "path": str(thumbnail_path)},
                )

            except Exception as e:
                logger.error(
                    f"Failed to generate {size.name} thumbnail: {e}",
                    extra={"size": size.dimensions, "error": str(e)},
                )
                raise

        logger.info(
            f"Generated {len(thumbnails)} thumbnails for asset {asset_id}",
            extra={"asset_id": asset_id, "sizes": list(thumbnails.keys())},
        )

        return thumbnails

    def _get_video_duration(self, video_path: Path) -> float:
        """Get video duration using ffprobe.

        Args:
            video_path: Path to video file

        Returns:
            float: Duration in seconds

        Raises:
            RuntimeError: If ffprobe fails
        """
        try:
            cmd = [
                self.ffprobe_path,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=10,
            )

            duration = float(result.stdout.strip())
            return duration

        except Exception as e:
            logger.warning(f"Failed to get video duration, using default: {e}")
            return 10.0  # Default fallback

    def _select_best_frame(self, candidate_paths: list[Path]) -> Path:
        """Select the best frame from candidates using histogram analysis.

        Avoids black/blank frames by analyzing histogram distribution.

        Args:
            candidate_paths: List of candidate frame paths

        Returns:
            Path: Path to best candidate frame

        Raises:
            RuntimeError: If no valid candidates found
        """
        logger.debug(f"Evaluating {len(candidate_paths)} candidate frames")

        best_frame = None
        best_score = -1

        for candidate_path in candidate_paths:
            try:
                with Image.open(candidate_path) as img:
                    # Convert to RGB if needed
                    if img.mode != "RGB":
                        img = img.convert("RGB")

                    # Calculate histogram score
                    score = self._calculate_histogram_score(img)

                    logger.debug(
                        f"Candidate {candidate_path.name} score: {score:.2f}",
                        extra={"candidate": candidate_path.name, "score": score},
                    )

                    if score > best_score:
                        best_score = score
                        best_frame = candidate_path

            except Exception as e:
                logger.warning(
                    f"Failed to evaluate candidate {candidate_path}: {e}",
                    extra={"candidate": str(candidate_path), "error": str(e)},
                )

        if best_frame is None:
            # Fallback to first candidate
            best_frame = candidate_paths[0]
            logger.warning("No valid histogram score, using first candidate")

        logger.info(
            f"Selected best frame: {best_frame.name} (score: {best_score:.2f})",
            extra={"frame": best_frame.name, "score": best_score},
        )

        return best_frame

    def _calculate_histogram_score(self, img: Image.Image) -> float:
        """Calculate a score for an image based on histogram distribution.

        Higher scores indicate better frame quality (more variation, less black/blank).

        Args:
            img: PIL Image object

        Returns:
            float: Histogram score (higher is better)
        """
        # Get histogram for each channel
        histogram = img.histogram()

        # Split into R, G, B channels (256 bins each)
        r_hist = histogram[0:256]
        g_hist = histogram[256:512]
        b_hist = histogram[512:768]

        # Calculate variance for each channel (measures distribution spread)
        def calculate_variance(hist: list[int]) -> float:
            total = sum(hist)
            if total == 0:
                return 0.0

            # Calculate mean
            mean = sum(i * count for i, count in enumerate(hist)) / total

            # Calculate variance
            variance = sum(count * (i - mean) ** 2 for i, count in enumerate(hist)) / total
            return variance

        r_var = calculate_variance(r_hist)
        g_var = calculate_variance(g_hist)
        b_var = calculate_variance(b_hist)

        # Average variance across channels
        avg_variance = (r_var + g_var + b_var) / 3

        # Penalize images with high concentration of dark pixels
        total_pixels = sum(r_hist)
        dark_pixels = sum(r_hist[0:50])  # Count very dark pixels
        dark_ratio = dark_pixels / total_pixels if total_pixels > 0 else 0

        # Score = variance * (1 - dark_ratio)
        # High variance and low dark_ratio = good frame
        score = avg_variance * (1.0 - dark_ratio)

        return score
