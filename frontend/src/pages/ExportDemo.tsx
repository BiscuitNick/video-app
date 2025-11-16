import React from 'react';
import {
  ExportModal,
  ExportButton,
  ExportManager,
} from '@/components/export';
import { Card } from '@/components/ui/card';

/**
 * ExportDemo - Demo page showcasing the export system
 * 
 * This page demonstrates all export system features:
 * - Export wizard trigger button
 * - Export modal with multi-step wizard
 * - Export queue showing active exports
 * - Export history with download/share capabilities
 */
export default function ExportDemo() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Export System Demo</h1>
          <p className="text-lg text-muted-foreground">
            Comprehensive export system with wizard, progress tracking, and download management
          </p>
        </div>

        {/* Export Button Demo */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">1. Start Export</h2>
              <p className="text-muted-foreground mb-4">
                Click the button below to open the export wizard and configure your export settings.
              </p>
            </div>
            <ExportButton />
          </div>
        </Card>

        {/* Export Manager Demo */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">2. Manage Exports</h2>
              <p className="text-muted-foreground mb-4">
                View active exports and download completed exports from your history.
              </p>
            </div>
            <ExportManager />
          </div>
        </Card>

        {/* Features List */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Export Wizard</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Multi-step workflow (Settings → Review → Progress)</li>
                <li>Aspect ratio presets with auto-resolution</li>
                <li>Quality slider with CRF mapping</li>
                <li>Format selection (MP4, MOV, WebM)</li>
                <li>Frame rate configuration</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Progress Tracking</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Real-time WebSocket updates</li>
                <li>Stage visualization (4 stages)</li>
                <li>Progress bar with percentage</li>
                <li>ETA calculation</li>
                <li>Automatic reconnection</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Download Management</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Automatic downloads</li>
                <li>Retry with exponential backoff</li>
                <li>Signed URL generation</li>
                <li>Shareable links</li>
                <li>Clipboard integration</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Queue & History</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Multiple concurrent exports</li>
                <li>Cancel with confirmation</li>
                <li>Paginated history (10 per page)</li>
                <li>Re-download capability</li>
                <li>Persistent storage</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Usage Instructions */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">How to Use</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Click the "Export" button to open the export wizard</li>
            <li>Configure your export settings (name, resolution, format, quality)</li>
            <li>Review your settings on the next screen</li>
            <li>Start the export and monitor progress in real-time</li>
            <li>Download your completed export or share it with others</li>
            <li>View all active and completed exports in the Export Manager below</li>
          </ol>
        </Card>

        {/* Integration Code */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Integration Code</h2>
          <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
            <code>{`import { 
  ExportModal, 
  ExportButton, 
  ExportManager 
} from '@/components/export';

function App() {
  return (
    <>
      <ExportButton />
      <ExportModal />
      <ExportManager />
    </>
  );
}`}</code>
          </pre>
        </Card>
      </div>

      {/* Export Modal (always rendered, controlled by store) */}
      <ExportModal />
    </div>
  );
}
