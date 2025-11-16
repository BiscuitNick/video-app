# Tag API Quick Reference

Quick reference guide for the Chronos Editor tagging system API endpoints.

---

## Base URL

```
http://localhost:8000/api/v1/tags
```

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all tags with pagination |
| POST | `/` | Create a new tag |
| GET | `/suggest?q=term` | Auto-complete tag suggestions |
| GET | `/{tag_id}` | Get single tag by ID |
| PATCH | `/{tag_id}` | Update tag properties |
| DELETE | `/{tag_id}` | Delete tag (with cascade) |
| POST | `/batch/tag` | Bulk tag operations |

---

## 1. List Tags

Get paginated list of tags with usage statistics.

### Request
```http
GET /api/v1/tags?offset=0&limit=50&sort_by=usage_count&sort_order=desc
```

### Query Parameters
- `offset` (int, optional): Pagination offset (default: 0)
- `limit` (int, optional): Items per page, max 100 (default: 50)
- `sort_by` (string, optional): Sort field - `usage_count`, `name`, `created_at` (default: `usage_count`)
- `sort_order` (string, optional): `asc` or `desc` (default: `desc`)
- `owner_user_id` (string, optional): Filter by owner

### Response (200 OK)
```json
{
  "tags": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "summer vacation",
      "slug": "summer-vacation",
      "color": "#FF5733",
      "description": "Summer holiday photos",
      "usage_count": 42,
      "owner_user_id": "default-user",
      "created_at": "2025-11-16T12:00:00Z",
      "updated_at": "2025-11-16T12:00:00Z"
    }
  ],
  "total": 100,
  "offset": 0,
  "limit": 50
}
```

### cURL Example
```bash
curl -X GET "http://localhost:8000/api/v1/tags?offset=0&limit=10&sort_by=usage_count&sort_order=desc"
```

---

## 2. Create Tag

Create a new tag with automatic normalization and slug generation.

### Request
```http
POST /api/v1/tags
Content-Type: application/json
```

### Request Body
```json
{
  "name": "Summer Vacation",
  "color": "#FF5733",
  "description": "Summer holiday photos"
}
```

### Fields
- `name` (string, required): Tag name (will be normalized)
- `color` (string, optional): Hex color code (e.g., `#FF5733`)
- `description` (string, optional): Tag description (max 500 chars)

### Response (201 Created)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "summer vacation",
  "slug": "summer-vacation",
  "color": "#FF5733",
  "description": "Summer holiday photos",
  "usage_count": 0,
  "owner_user_id": "default-user",
  "created_at": "2025-11-16T12:00:00Z",
  "updated_at": "2025-11-16T12:00:00Z"
}
```

### Error Responses
- **409 Conflict**: Tag with same normalized name already exists
- **400 Bad Request**: Invalid input (empty name, invalid color, etc.)

### cURL Example
```bash
curl -X POST "http://localhost:8000/api/v1/tags" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Vacation",
    "color": "#FF5733",
    "description": "Summer holiday photos"
  }'
```

---

## 3. Tag Auto-Complete

Get tag suggestions with fuzzy matching for auto-complete features.

### Request
```http
GET /api/v1/tags/suggest?q=sumr&limit=10&min_score=0.3
```

### Query Parameters
- `q` (string, required): Search query (min 1 char)
- `limit` (int, optional): Max suggestions, max 50 (default: 10)
- `min_score` (float, optional): Min fuzzy match score 0-1 (default: 0.3)
- `owner_user_id` (string, optional): Filter by owner

### Response (200 OK)
```json
{
  "suggestions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "summer",
      "slug": "summer",
      "usage_count": 42,
      "match_score": 0.800
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "summer vacation",
      "slug": "summer-vacation",
      "usage_count": 15,
      "match_score": 0.650
    }
  ],
  "total": 2
}
```

### Matching Algorithm
- Uses SequenceMatcher for fuzzy matching
- Substring match bonus: +0.2
- Prefix match bonus: +0.1
- Results sorted by: match_score (desc), usage_count (desc)

### cURL Example
```bash
curl -X GET "http://localhost:8000/api/v1/tags/suggest?q=sumr&limit=10&min_score=0.3"
```

---

## 4. Get Single Tag

Retrieve detailed information about a specific tag.

### Request
```http
GET /api/v1/tags/{tag_id}
```

### Path Parameters
- `tag_id` (UUID, required): Tag UUID

### Response (200 OK)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "summer vacation",
  "slug": "summer-vacation",
  "color": "#FF5733",
  "description": "Summer holiday photos",
  "usage_count": 42,
  "owner_user_id": "default-user",
  "created_at": "2025-11-16T12:00:00Z",
  "updated_at": "2025-11-16T12:00:00Z"
}
```

### Error Responses
- **404 Not Found**: Tag does not exist

### cURL Example
```bash
curl -X GET "http://localhost:8000/api/v1/tags/550e8400-e29b-41d4-a716-446655440000"
```

---

## 5. Update Tag

Update tag properties (name, color, description).

### Request
```http
PATCH /api/v1/tags/{tag_id}
Content-Type: application/json
```

### Request Body
All fields are optional - only provide fields to update:
```json
{
  "name": "Updated Tag Name",
  "color": "#00FF00",
  "description": "Updated description"
}
```

### Response (200 OK)
Returns the updated tag object.

### Error Responses
- **404 Not Found**: Tag does not exist
- **409 Conflict**: New name conflicts with existing tag

### cURL Example
```bash
curl -X PATCH "http://localhost:8000/api/v1/tags/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Tag Name",
    "color": "#00FF00"
  }'
```

---

## 6. Delete Tag

Delete a tag with optional cascade to remove from all media assets.

### Request
```http
DELETE /api/v1/tags/{tag_id}?cascade=true
```

### Query Parameters
- `cascade` (boolean, optional): Remove from all media assets (default: true)

### Response (200 OK)
```json
{
  "success": true,
  "tag_id": "550e8400-e29b-41d4-a716-446655440000",
  "cascade_deleted": 42,
  "message": "Tag 'summer vacation' deleted successfully. Removed from 42 media asset(s)."
}
```

### Error Responses
- **404 Not Found**: Tag does not exist
- **409 Conflict**: Tag in use and `cascade=false`

### cURL Example
```bash
# Delete with cascade (removes from all assets)
curl -X DELETE "http://localhost:8000/api/v1/tags/550e8400-e29b-41d4-a716-446655440000?cascade=true"

# Delete only if not in use
curl -X DELETE "http://localhost:8000/api/v1/tags/550e8400-e29b-41d4-a716-446655440000?cascade=false"
```

---

## 7. Bulk Tag Operations

Apply tags to multiple media assets in a single operation.

### Request
```http
POST /api/v1/tags/batch/tag
Content-Type: application/json
```

### Request Body
```json
{
  "media_asset_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ],
  "tag_names": ["summer", "vacation", "2024"],
  "operation": "add"
}
```

### Fields
- `media_asset_ids` (array of UUIDs, required): Media assets to tag
- `tag_names` (array of strings, required): Tag names to apply
- `operation` (string, required): Operation mode

### Operation Modes
- `"add"` - Add tags to existing tags (keeps current tags)
- `"remove"` - Remove specific tags from assets
- `"replace"` - Replace ALL tags with the specified tags

### Response (200 OK)
```json
{
  "success": true,
  "processed_count": 3,
  "tags_affected": 9,
  "errors": []
}
```

### Features
- **Auto-creates tags** if they don't exist
- **Normalizes tag names** automatically
- **Atomic operation** - rolls back on error
- **Updates usage_count** automatically

### Error Responses
- **404 Not Found**: One or more media assets not found
- **400 Bad Request**: Invalid input

### cURL Examples

**Add tags to assets:**
```bash
curl -X POST "http://localhost:8000/api/v1/tags/batch/tag" \
  -H "Content-Type: application/json" \
  -d '{
    "media_asset_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001"
    ],
    "tag_names": ["summer", "vacation"],
    "operation": "add"
  }'
```

**Remove tags from assets:**
```bash
curl -X POST "http://localhost:8000/api/v1/tags/batch/tag" \
  -H "Content-Type: application/json" \
  -d '{
    "media_asset_ids": [
      "550e8400-e29b-41d4-a716-446655440000"
    ],
    "tag_names": ["old-tag"],
    "operation": "remove"
  }'
```

**Replace all tags on assets:**
```bash
curl -X POST "http://localhost:8000/api/v1/tags/batch/tag" \
  -H "Content-Type: application/json" \
  -d '{
    "media_asset_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440001"
    ],
    "tag_names": ["new-tag-1", "new-tag-2"],
    "operation": "replace"
  }'
```

---

## Alternative Endpoint

The same bulk tagging functionality is also available at:
```
POST /api/v1/media/batch/tag
```

This endpoint has the same interface but is located under the media router.

---

## Tag Normalization Rules

When creating or updating tags, names are automatically normalized:

1. **Lowercase**: "Summer" → "summer"
2. **Trim whitespace**: "  tag  " → "tag"
3. **Remove special characters**: "tag!" → "tag"
4. **Remove accents**: "café" → "cafe"
5. **Collapse spaces**: "tag   name" → "tag name"
6. **Generate slug**: "Summer Vacation" → "summer-vacation"

### Examples
```
Input               → Normalized        → Slug
"Summer Vacation"   → "summer vacation" → "summer-vacation"
"2024-Café!"        → "2024-cafe"       → "2024-cafe"
"  Best  Moments  " → "best moments"    → "best-moments"
```

---

## Interactive API Documentation

Visit the interactive API documentation for testing:
```
http://localhost:8000/docs
```

This provides a Swagger UI where you can:
- Try all endpoints
- See request/response schemas
- View validation rules
- Test with sample data

---

## Python Client Example

```python
import requests

BASE_URL = "http://localhost:8000/api/v1/tags"

# Create a tag
response = requests.post(
    BASE_URL,
    json={
        "name": "Summer Vacation",
        "color": "#FF5733",
        "description": "Summer holiday photos"
    }
)
tag = response.json()
print(f"Created tag: {tag['name']} (ID: {tag['id']})")

# Get suggestions
response = requests.get(
    f"{BASE_URL}/suggest",
    params={"q": "sumr", "limit": 5}
)
suggestions = response.json()
for suggestion in suggestions["suggestions"]:
    print(f"- {suggestion['name']} (score: {suggestion['match_score']:.2f})")

# Bulk tag media assets
response = requests.post(
    f"{BASE_URL}/batch/tag",
    json={
        "media_asset_ids": ["uuid1", "uuid2"],
        "tag_names": ["summer", "vacation"],
        "operation": "add"
    }
)
result = response.json()
print(f"Tagged {result['processed_count']} assets")
```

---

## JavaScript/TypeScript Client Example

```typescript
const BASE_URL = "http://localhost:8000/api/v1/tags";

// Create a tag
const response = await fetch(BASE_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Summer Vacation",
    color: "#FF5733",
    description: "Summer holiday photos"
  })
});
const tag = await response.json();
console.log(`Created tag: ${tag.name} (ID: ${tag.id})`);

// Get suggestions (for auto-complete)
const suggestResponse = await fetch(
  `${BASE_URL}/suggest?q=sumr&limit=5`
);
const { suggestions } = await suggestResponse.json();
suggestions.forEach(s => {
  console.log(`- ${s.name} (score: ${s.match_score.toFixed(2)})`);
});

// Bulk tag assets
const bulkResponse = await fetch(`${BASE_URL}/batch/tag`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    media_asset_ids: ["uuid1", "uuid2"],
    tag_names: ["summer", "vacation"],
    operation: "add"
  })
});
const result = await bulkResponse.json();
console.log(`Tagged ${result.processed_count} assets`);
```

---

## Common Use Cases

### 1. Tag Auto-Complete in Search Box
```javascript
async function getTagSuggestions(query) {
  const response = await fetch(
    `/api/v1/tags/suggest?q=${encodeURIComponent(query)}&limit=10&min_score=0.3`
  );
  return await response.json();
}

// Usage in search input
searchInput.addEventListener('input', async (e) => {
  const query = e.target.value;
  if (query.length >= 2) {
    const { suggestions } = await getTagSuggestions(query);
    displaySuggestions(suggestions);
  }
});
```

### 2. Tag Cloud / Popular Tags
```javascript
async function getPopularTags(limit = 20) {
  const response = await fetch(
    `/api/v1/tags?limit=${limit}&sort_by=usage_count&sort_order=desc`
  );
  return await response.json();
}
```

### 3. Batch Apply Tags to Selected Assets
```javascript
async function tagSelectedAssets(assetIds, tagNames) {
  const response = await fetch('/api/v1/tags/batch/tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_asset_ids: assetIds,
      tag_names: tagNames,
      operation: 'add'
    })
  });
  return await response.json();
}
```

---

## Best Practices

1. **Use fuzzy search for auto-complete**: Set `min_score=0.3` for flexible matching
2. **Sort by usage_count**: Show most popular tags first
3. **Batch operations**: Use bulk endpoints when tagging multiple assets
4. **Tag normalization**: Let the API normalize tag names automatically
5. **Cascade delete**: Use `cascade=true` when deleting tags to clean up relationships
6. **Pagination**: Always paginate large tag lists

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate or constraint violation
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "detail": "Tag with name 'summer vacation' already exists"
}
```

---

For more information, visit the interactive API docs at: `http://localhost:8000/docs`
