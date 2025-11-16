# Export System Workflow Tests

This document describes how to test the export system UI components.

## Setup

1. Import the export components and modal in your app:

\`\`\`tsx
import { ExportModal, ExportButton, ExportManager } from '@/components/export';

function App() {
  return (
    <>
      <ExportButton />
      <ExportModal />
      <ExportManager />
    </>
  );
}
\`\`\`

2. Ensure the stores are properly initialized in your app's index file.

## Test Scenarios

### 1. Opening the Export Wizard

**Steps:**
1. Click the "Export" button
2. Verify the export modal opens
3. Verify the wizard shows step 1 (Settings)
4. Verify all form fields are populated with default values

**Expected:**
- Modal opens smoothly
- Step indicator shows "Settings" as active
- Default values: 1920x1080, MP4, 75% quality, 30 FPS

### 2. Configuring Export Settings

**Steps:**
1. Change export name to "My Test Export"
2. Select aspect ratio "9:16" (Portrait)
3. Verify resolution auto-updates to 1080x1920
4. Change format to "WebM"
5. Adjust quality slider to 90%
6. Change frame rate to 60 FPS
7. Click "Continue to Review"

**Expected:**
- Resolution updates automatically when aspect ratio changes
- Quality label shows correct CRF value
- Preview card updates with new settings
- Wizard advances to Review step

### 3. Reviewing Export Settings

**Steps:**
1. Verify all settings from step 2 are displayed correctly
2. Click "Back to Settings"
3. Verify wizard returns to Settings step with values preserved
4. Click "Continue to Review" again
5. Click "Start Export"

**Expected:**
- Review shows all configured settings
- Navigation works in both directions
- Settings are persisted during navigation
- Export job is created via API

### 4. Monitoring Export Progress

**Steps:**
1. After starting export, wizard shows Progress step
2. Verify WebSocket connection is established
3. Monitor the stage visualization
4. Observe progress bar updates

**Expected:**
- Progress step shows stage indicators
- Active stage is highlighted
- Progress bar fills as export progresses
- ETA is calculated and displayed

**Mock WebSocket Messages:**
\`\`\`json
// Downloading stage
{"type": "export:progress", "payload": {"stage": "downloading", "progress": 25}}

// Rendering stage
{"type": "export:progress", "payload": {"stage": "rendering", "progress": 50, "currentFrame": 500, "totalFrames": 1000}}

// Encoding stage
{"type": "export:progress", "payload": {"stage": "encoding", "progress": 75, "estimatedTimeRemaining": 30}}

// Completion
{"type": "export:completed", "payload": {"outputUrl": "https://..."}}
\`\`\`

### 5. WebSocket Reconnection

**Steps:**
1. During export progress, simulate WebSocket disconnection
2. Verify reconnection logic triggers
3. Observe connection status indicator

**Expected:**
- Yellow warning card appears when disconnected
- Auto-reconnect attempts are made
- "Retry" button is available
- Progress continues when reconnected

### 6. Export Completion

**Steps:**
1. Wait for export to complete
2. Verify completion status is shown
3. Click "Close" button

**Expected:**
- Green success card appears
- "Download" option is available
- Wizard can be closed
- Export appears in history

### 7. Export Queue

**Steps:**
1. Start multiple exports simultaneously
2. Navigate to Export Manager
3. View active exports in Queue tab

**Expected:**
- All active exports are listed
- Each shows individual progress
- Cancel button is available for each
- Real-time updates for all exports

### 8. Cancelling Export

**Steps:**
1. Click cancel (X) button on an active export
2. Confirm cancellation in dialog
3. Verify export is cancelled

**Expected:**
- Confirmation dialog appears
- Export is removed from queue on confirmation
- API cancel endpoint is called
- Export does not appear in history

### 9. Export History

**Steps:**
1. Navigate to History tab in Export Manager
2. Verify completed exports are listed
3. Test download button
4. Test share button
5. Test delete button

**Expected:**
- Completed exports show green checkmark
- Failed exports show red X with error message
- Download triggers file download
- Share copies link to clipboard
- Delete removes from history after confirmation

### 10. Download with Retry

**Steps:**
1. Click download on a completed export
2. Simulate network failure during download
3. Verify retry logic executes

**Expected:**
- Download begins
- Retry attempts are logged
- Exponential backoff is applied
- Download completes or fails after max retries

### 11. Pagination

**Steps:**
1. Create more than 10 exports
2. Navigate to History tab
3. Test pagination controls

**Expected:**
- Only 10 items shown per page
- Previous/Next buttons work correctly
- Page indicator shows current page
- Buttons are disabled at boundaries

### 12. Persistent History

**Steps:**
1. Complete several exports
2. Refresh the page
3. Navigate to History tab

**Expected:**
- Export history persists across page reloads
- Active exports do not persist (expected)
- Settings are reset to defaults

## Edge Cases

### Empty States
- Empty queue: Shows "No active exports" message
- Empty history: Shows "No export history" message with icon

### Error Handling
- Failed export shows error message
- Network errors show appropriate warnings
- API failures are caught and displayed

### Validation
- Required fields are validated
- Numeric inputs have min/max constraints
- Custom resolution validates aspect ratio

## Performance Tests

1. **Multiple Active Exports**: Test with 5+ simultaneous exports
2. **Large History**: Test with 100+ historical exports
3. **WebSocket Load**: Monitor memory usage during long exports
4. **Download Speed**: Test download with various file sizes

## Accessibility Tests

1. Keyboard navigation through wizard
2. Screen reader compatibility
3. Focus management in modal
4. ARIA labels and descriptions

## Browser Compatibility

Test in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
