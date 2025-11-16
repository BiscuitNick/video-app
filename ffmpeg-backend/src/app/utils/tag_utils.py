"""Utility functions for tag normalization and operations."""

import re
import unicodedata
from difflib import SequenceMatcher


def normalize_tag_name(name: str) -> str:
    """
    Normalize a tag name for consistent storage and matching.

    Normalization steps:
    1. Strip leading/trailing whitespace
    2. Convert to lowercase
    3. Remove special characters (keep alphanumeric, spaces, hyphens, underscores)
    4. Collapse multiple spaces to single space
    5. Remove accents/diacritics

    Args:
        name: Raw tag name input

    Returns:
        Normalized tag name

    Examples:
        >>> normalize_tag_name("  Summer Vacation! ")
        "summer vacation"
        >>> normalize_tag_name("2024-Café")
        "2024-cafe"
    """
    # Strip whitespace
    name = name.strip()

    # Convert to lowercase
    name = name.lower()

    # Remove accents and diacritics
    name = remove_accents(name)

    # Remove special characters (keep alphanumeric, spaces, hyphens, underscores)
    name = re.sub(r"[^\w\s-]", "", name)

    # Collapse multiple spaces/underscores to single space
    name = re.sub(r"[\s_]+", " ", name)

    # Final trim
    name = name.strip()

    return name


def remove_accents(text: str) -> str:
    """
    Remove accents and diacritical marks from text.

    Args:
        text: Input text with potential accents

    Returns:
        Text with accents removed

    Examples:
        >>> remove_accents("café")
        "cafe"
        >>> remove_accents("naïve")
        "naive"
    """
    # Normalize to NFD (decomposed form)
    nfd = unicodedata.normalize("NFD", text)

    # Filter out combining characters (accents)
    return "".join(char for char in nfd if unicodedata.category(char) != "Mn")


def generate_slug(name: str) -> str:
    """
    Generate a URL-friendly slug from a tag name.

    Args:
        name: Tag name

    Returns:
        URL-friendly slug

    Examples:
        >>> generate_slug("Summer Vacation")
        "summer-vacation"
        >>> generate_slug("Best Moments 2024!")
        "best-moments-2024"
    """
    # Normalize the name first
    normalized = normalize_tag_name(name)

    # Replace spaces with hyphens
    slug = normalized.replace(" ", "-")

    # Remove any remaining non-alphanumeric characters except hyphens
    slug = re.sub(r"[^a-z0-9-]", "", slug)

    # Collapse multiple hyphens to single hyphen
    slug = re.sub(r"-+", "-", slug)

    # Remove leading/trailing hyphens
    slug = slug.strip("-")

    return slug


def fuzzy_match_score(query: str, target: str) -> float:
    """
    Calculate fuzzy match score between query and target strings.

    Uses SequenceMatcher for similarity calculation.

    Args:
        query: Search query string
        target: Target string to match against

    Returns:
        Match score between 0.0 and 1.0 (higher is better)

    Examples:
        >>> fuzzy_match_score("sumr", "summer")
        0.8
        >>> fuzzy_match_score("vacation", "vacations")
        0.9
    """
    # Normalize both strings for comparison
    query_norm = normalize_tag_name(query)
    target_norm = normalize_tag_name(target)

    if not query_norm or not target_norm:
        return 0.0

    # Use SequenceMatcher for similarity ratio
    matcher = SequenceMatcher(None, query_norm, target_norm)

    # Get similarity ratio
    base_score = matcher.ratio()

    # Boost score if query is a substring of target
    if query_norm in target_norm:
        # Exact substring match gets bonus
        substring_bonus = 0.2
        base_score = min(1.0, base_score + substring_bonus)

    # Boost score if target starts with query
    if target_norm.startswith(query_norm):
        # Prefix match gets additional bonus
        prefix_bonus = 0.1
        base_score = min(1.0, base_score + prefix_bonus)

    return round(base_score, 3)


def validate_tag_name(name: str, min_length: int = 1, max_length: int = 100) -> tuple[bool, str | None]:
    """
    Validate a tag name.

    Args:
        name: Tag name to validate
        min_length: Minimum allowed length (default: 1)
        max_length: Maximum allowed length (default: 100)

    Returns:
        Tuple of (is_valid, error_message)

    Examples:
        >>> validate_tag_name("valid-tag")
        (True, None)
        >>> validate_tag_name("")
        (False, "Tag name cannot be empty")
        >>> validate_tag_name("a" * 101)
        (False, "Tag name cannot exceed 100 characters")
    """
    # Check if empty
    if not name or not name.strip():
        return False, "Tag name cannot be empty"

    # Normalize and check length
    normalized = normalize_tag_name(name)

    if len(normalized) < min_length:
        return False, f"Tag name must be at least {min_length} character(s)"

    if len(normalized) > max_length:
        return False, f"Tag name cannot exceed {max_length} characters"

    # Check if normalized name is empty (all special chars removed)
    if not normalized:
        return False, "Tag name must contain at least one alphanumeric character"

    return True, None


def sanitize_tag_list(tags: list[str]) -> list[str]:
    """
    Sanitize a list of tag names by normalizing and removing duplicates.

    Args:
        tags: List of raw tag names

    Returns:
        List of normalized, deduplicated tag names

    Examples:
        >>> sanitize_tag_list(["Summer", "SUMMER", "  summer  "])
        ["summer"]
        >>> sanitize_tag_list(["Tag1", "Tag2", "Tag1"])
        ["tag1", "tag2"]
    """
    normalized_tags = []
    seen = set()

    for tag in tags:
        # Normalize the tag
        normalized = normalize_tag_name(tag)

        # Skip empty tags
        if not normalized:
            continue

        # Skip duplicates (case-insensitive)
        if normalized not in seen:
            normalized_tags.append(normalized)
            seen.add(normalized)

    return normalized_tags
