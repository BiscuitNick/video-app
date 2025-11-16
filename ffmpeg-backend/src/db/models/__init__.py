"""
Database models.
"""

from db.models.composition import Composition, CompositionStatus
from db.models.folder import Folder
from db.models.job import JobMetric, JobStatus, JobType, MetricType, ProcessingJob
from db.models.media_asset import MediaAsset, MediaAssetTag, MediaAssetType, Tag
from db.models.project import (
    Project,
    ProjectShare,
    ProjectStatus,
    ProjectVersion,
    SharePermission,
)

__all__ = [
    # Composition models
    "Composition",
    "CompositionStatus",
    # Job models
    "ProcessingJob",
    "JobStatus",
    "JobType",
    # Metrics models
    "JobMetric",
    "MetricType",
    # Media asset models
    "MediaAsset",
    "MediaAssetType",
    "MediaAssetTag",
    "Folder",
    "Tag",
    # Project models
    "Project",
    "ProjectVersion",
    "ProjectShare",
    "ProjectStatus",
    "SharePermission",
]
