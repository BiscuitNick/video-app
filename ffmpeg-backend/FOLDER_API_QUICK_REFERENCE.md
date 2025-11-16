# Folder Management API - Quick Reference

## Base URL
```
http://localhost:8000/api/v1/folders
```

## Endpoints

### 1. Create Folder
```http
POST /api/v1/folders
Content-Type: application/json

{
  "name": "My Videos",
  "parent_id": null  // or UUID for nested folder
}

Response: 201 Created
{
  "id": "uuid",
  "name": "My Videos",
  "parent_id": null,
  "path": "/My Videos",
  "owner_user_id": "default-user",
  "created_at": "2025-11-16T...",
  "updated_at": "2025-11-16T...",
  "breadcrumbs": [
    {"name": "My Videos", "path": "/My Videos"}
  ]
}
```

### 2. List All Folders (Tree)
```http
GET /api/v1/folders?owner_user_id=default-user

Response: 200 OK
{
  "folders": [
    {
      "id": "uuid1",
      "name": "Root1",
      "parent_id": null,
      "path": "/Root1",
      "created_at": "...",
      "children": [
        {
          "id": "uuid2",
          "name": "Child1",
          "parent_id": "uuid1",
          "path": "/Root1/Child1",
          "created_at": "...",
          "children": []
        }
      ]
    }
  ],
  "total": 2
}
```

### 3. Get Folder Contents
```http
GET /api/v1/folders/{folder_id}/contents?offset=0&limit=50

Response: 200 OK
{
  "folder": {
    "id": "uuid",
    "name": "My Videos",
    "parent_id": null,
    "path": "/My Videos",
    ...
  },
  "subfolders": [
    {
      "id": "uuid2",
      "name": "Subfolder1",
      ...
    }
  ],
  "total_subfolders": 5,
  "offset": 0,
  "limit": 50
}
```

### 4. Rename Folder
```http
PATCH /api/v1/folders/{folder_id}
Content-Type: application/json

{
  "name": "Renamed Folder"
}

Response: 200 OK
// Returns updated FolderResponse
```

### 5. Move Folder
```http
PATCH /api/v1/folders/{folder_id}
Content-Type: application/json

{
  "parent_id": "new-parent-uuid"
}

Response: 200 OK
// Returns updated FolderResponse
// All descendant paths automatically updated
```

### 6. Rename AND Move Folder
```http
PATCH /api/v1/folders/{folder_id}
Content-Type: application/json

{
  "name": "New Name",
  "parent_id": "new-parent-uuid"
}

Response: 200 OK
```

### 7. Delete Empty Folder
```http
DELETE /api/v1/folders/{folder_id}

Response: 200 OK
{
  "success": true,
  "folder_id": "uuid",
  "message": "Folder 'My Videos' deleted successfully"
}

Error: 400 Bad Request (if folder has contents)
{
  "detail": "Cannot delete non-empty folder. Use cascade=true to force deletion."
}
```

### 8. Force Delete Folder with Contents
```http
DELETE /api/v1/folders/{folder_id}?cascade=true

Response: 200 OK
{
  "success": true,
  "folder_id": "uuid",
  "message": "Folder 'My Videos' deleted successfully"
}

// All subfolders and media assets deleted via CASCADE
```

## Common Error Responses

### 404 Not Found
```json
{
  "detail": "Folder with ID {id} not found"
}
```

### 400 Bad Request - Circular Reference
```json
{
  "detail": "Cannot move folder: circular reference detected"
}
```

### 400 Bad Request - Invalid Name
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "name"],
      "msg": "Folder name cannot contain '/'"
    }
  ]
}
```

## Folder Path Examples

```
/                           (root level)
/Media                      (top-level folder)
/Media/Videos              (nested folder)
/Media/Videos/2024         (deeply nested)
/Media/Videos/2024/Summer  (4 levels deep)
```

## Breadcrumb Format

```json
{
  "breadcrumbs": [
    {"name": "Media", "path": "/Media"},
    {"name": "Videos", "path": "/Media/Videos"},
    {"name": "2024", "path": "/Media/Videos/2024"}
  ]
}
```

## Key Features

1. **Materialized Path**: Efficient tree queries using path-based lookups
2. **Circular Prevention**: Cannot move folder into its own subtree
3. **Atomic Moves**: All descendant paths updated in single transaction
4. **Cascade Delete**: Database handles recursive deletion automatically
5. **Pagination**: Folder contents support offset/limit parameters

## Testing with cURL

```bash
# Create root folder
curl -X POST http://localhost:8000/api/v1/folders \
  -H "Content-Type: application/json" \
  -d '{"name":"Media","parent_id":null}'

# List folders
curl http://localhost:8000/api/v1/folders?owner_user_id=default-user

# Get folder contents
curl http://localhost:8000/api/v1/folders/{folder-id}/contents

# Rename folder
curl -X PATCH http://localhost:8000/api/v1/folders/{folder-id} \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# Delete folder
curl -X DELETE http://localhost:8000/api/v1/folders/{folder-id}
```

## Interactive API Documentation

Visit: http://localhost:8000/docs

Look for the "folders" tag to see all endpoints with interactive testing.
