# Task 22 Quick Reference Guide

## Backend API Endpoints

### Project CRUD
```bash
# Create project
POST /api/v1/projects
{
  "name": "My Project",
  "description": "Project description",
  "project_data": {},
  "thumbnail_url": "https://...",
  "folder_id": "uuid"
}

# List projects
GET /api/v1/projects?offset=0&limit=50&sort_by=updated_at&sort_order=desc&search=query

# Get project
GET /api/v1/projects/{id}

# Update project (requires version for optimistic locking)
PUT /api/v1/projects/{id}
{
  "name": "Updated Name",
  "project_data": {...},
  "version": 1,
  "change_summary": "Made changes"
}

# Delete project
DELETE /api/v1/projects/{id}?hard_delete=false
```

### Sharing
```bash
# Share project
POST /api/v1/projects/{id}/share
{
  "shared_with_user_id": "user_456",
  "permission": "edit"  # view, edit, admin
}

# List shares
GET /api/v1/projects/{id}/shares

# Remove share
DELETE /api/v1/projects/{id}/shares/{share_id}
```

### Version History
```bash
# Get versions
GET /api/v1/projects/{id}/versions?limit=50

# Get specific version
GET /api/v1/projects/{id}/versions/{version_number}
```

### Utilities
```bash
# Duplicate project
POST /api/v1/projects/{id}/duplicate
{
  "new_name": "Copy of Project",
  "include_version_history": false
}

# Bulk operations
POST /api/v1/projects/bulk
{
  "project_ids": ["id1", "id2"],
  "operation": "archive",  # archive, delete, move
  "target_folder_id": "uuid"  # for move operation
}
```

## Frontend Usage

### React Query Hooks

```typescript
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useDuplicateProject,
  useShareProject,
  useProjectVersions,
  useBulkOperation
} from '@/hooks/useProjects';

// List projects
const { data, isLoading } = useProjects({
  search: 'query',
  sort_by: 'updated_at',
  sort_order: 'desc',
  status_filter: 'active',
  offset: 0,
  limit: 50
});

// Get single project
const { data: project } = useProject(projectId);

// Create project
const createMutation = useCreateProject();
createMutation.mutate({
  name: 'New Project',
  description: 'Description',
  project_data: {}
});

// Update project (with optimistic locking)
const updateMutation = useUpdateProject();
updateMutation.mutate({
  id: projectId,
  input: {
    name: 'Updated',
    project_data: {...},
    version: currentVersion,  // REQUIRED
    change_summary: 'What changed'
  }
});

// Delete project
const deleteMutation = useDeleteProject();
deleteMutation.mutate({ id: projectId, hardDelete: false });

// Duplicate project
const duplicateMutation = useDuplicateProject();
duplicateMutation.mutate({
  id: projectId,
  input: {
    new_name: 'Copy',
    include_version_history: false
  }
});

// Share project
const shareMutation = useShareProject();
shareMutation.mutate({
  id: projectId,
  input: {
    shared_with_user_id: 'user_456',
    permission: 'edit'
  }
});

// Get version history
const { data: versions } = useProjectVersions(projectId);

// Bulk operations
const bulkMutation = useBulkOperation();
bulkMutation.mutate({
  project_ids: ['id1', 'id2'],
  operation: 'archive'
});
```

## Database Schema

### Projects Table
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  thumbnail_url VARCHAR(1024),
  description TEXT,
  project_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_id VARCHAR(255) NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status project_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_projects_name ON projects(name);
CREATE INDEX ix_projects_owner_id ON projects(owner_id);
CREATE INDEX ix_projects_status ON projects(status);
CREATE INDEX ix_projects_owner_status ON projects(owner_id, status);
CREATE INDEX ix_projects_folder_status ON projects(folder_id, status);
CREATE INDEX ix_projects_project_data ON projects USING gin(project_data);
```

### Project Versions Table
```sql
CREATE TABLE project_versions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  project_data_snapshot JSONB NOT NULL,
  change_summary TEXT,
  is_auto_save BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(255) NOT NULL,
  vector_clock JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, version_number)
);

CREATE INDEX ix_project_versions_project_id ON project_versions(project_id);
CREATE INDEX ix_project_versions_project_created ON project_versions(project_id, created_at);
CREATE INDEX ix_project_versions_snapshot ON project_versions USING gin(project_data_snapshot);
```

### Project Shares Table
```sql
CREATE TABLE project_shares (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shared_with_user_id VARCHAR(255) NOT NULL,
  permission share_permission NOT NULL,
  shared_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, shared_with_user_id)
);

CREATE INDEX ix_project_shares_project_id ON project_shares(project_id);
CREATE INDEX ix_project_shares_shared_with_user_id ON project_shares(shared_with_user_id);
CREATE INDEX ix_project_shares_user_project ON project_shares(shared_with_user_id, project_id);
```

## Optimistic Locking Pattern

```typescript
// 1. Load current project
const { data: project } = useProject(id);

// 2. Update with version check
const updateMutation = useUpdateProject();

try {
  await updateMutation.mutateAsync({
    id,
    input: {
      ...changes,
      version: project.version  // Current version
    }
  });
  // Success - version incremented
} catch (error) {
  if (error.response?.status === 409) {
    // Version conflict - someone else updated
    // Show conflict resolution UI
    handleVersionConflict();
  }
}
```

## Permission Checks

### Backend (in endpoints)
```python
# Owner check
if project.owner_id != user_id:
    raise HTTPException(403, "Not authorized")

# Edit permission check
has_edit = project.owner_id == user_id or any(
    share.shared_with_user_id == user_id
    and share.permission in (SharePermission.EDIT, SharePermission.ADMIN)
    for share in project.shares
)
if not has_edit:
    raise HTTPException(403, "No edit permission")

# View permission check
has_access = project.owner_id == user_id or any(
    share.shared_with_user_id == user_id
    for share in project.shares
)
```

### Frontend (for UI)
```typescript
// Check if user can edit
const canEdit = project.owner_id === currentUserId ||
  project.shares.some(s =>
    s.shared_with_user_id === currentUserId &&
    ['edit', 'admin'].includes(s.permission)
  );

// Check if user is owner
const isOwner = project.owner_id === currentUserId;

// Check if user has admin rights
const canAdmin = isOwner || project.shares.some(s =>
  s.shared_with_user_id === currentUserId &&
  s.permission === 'admin'
);
```

## Error Handling

```typescript
const updateMutation = useUpdateProject();

updateMutation.mutate(
  { id, input },
  {
    onSuccess: (data) => {
      console.log('Updated:', data);
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        // Version conflict
        toast.error('Project was modified by someone else');
      } else if (error.response?.status === 403) {
        // Permission denied
        toast.error('You do not have permission');
      } else {
        toast.error('Update failed');
      }
    }
  }
);
```

## Migration Commands

```bash
# Create migration (auto-generate)
alembic revision --autogenerate -m "project management"

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1

# Check current version
alembic current

# Show migration history
alembic history
```

## Testing Examples

### Backend Test
```python
async def test_optimistic_locking():
    # Create project
    project = await create_project(db, user_id="user1")

    # Simulate concurrent updates
    update1 = {"version": 1, "name": "Update 1"}
    update2 = {"version": 1, "name": "Update 2"}

    # First update succeeds
    result1 = await update_project(db, project.id, update1)
    assert result1.version == 2

    # Second update fails (stale version)
    with pytest.raises(HTTPException) as exc:
        await update_project(db, project.id, update2)
    assert exc.value.status_code == 409
```

### Frontend Test
```typescript
test('handles version conflict', async () => {
  const { result } = renderHook(() => useUpdateProject());

  // Mock 409 response
  server.use(
    http.put('/api/v1/projects/:id', () => {
      return new HttpResponse(null, { status: 409 });
    })
  );

  await act(async () => {
    result.current.mutate({ id: '1', input: { version: 1 } });
  });

  expect(result.current.error).toBeDefined();
  expect(result.current.error.response.status).toBe(409);
});
```

## Files Reference

### Backend
- Models: `/home/user/video-app/ffmpeg-backend/src/db/models/project.py`
- Schemas: `/home/user/video-app/ffmpeg-backend/src/app/api/schemas/project.py`
- Endpoints: `/home/user/video-app/ffmpeg-backend/src/app/api/v1/projects.py`
- Migration: `/home/user/video-app/ffmpeg-backend/migrations/versions/003_project_management.py`

### Frontend
- Types: `/home/user/video-app/frontend/src/types/api.ts`
- API: `/home/user/video-app/frontend/src/services/api/projects.ts`
- Hooks: `/home/user/video-app/frontend/src/hooks/useProjects.ts`
