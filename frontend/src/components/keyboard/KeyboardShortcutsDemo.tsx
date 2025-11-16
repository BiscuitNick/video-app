import { useState } from 'react';
import { Keyboard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ShortcutsHelpModal } from '@/components/ui/ShortcutsHelpModal';
import { ShortcutCustomizationPanel } from '@/components/ui/ShortcutEditor';
import { ShortcutBadge, ShortcutHint } from './ShortcutTooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Demo component showing keyboard shortcuts features
 *
 * This demonstrates:
 * - How to show the shortcuts help modal
 * - How to customize shortcuts
 * - How to display shortcut hints in the UI
 */
export const KeyboardShortcutsDemo = () => {
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Keyboard Shortcuts System</h1>
        <p className="text-muted-foreground">
          Comprehensive keyboard shortcuts management for the video editor
        </p>
      </div>

      <Tabs defaultValue="demo">
        <TabsList>
          <TabsTrigger value="demo">Demo</TabsTrigger>
          <TabsTrigger value="customize">Customize</TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common shortcuts with visual hints
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="justify-between">
                  Play/Pause
                  <ShortcutBadge shortcutId="playback.play-pause" />
                </Button>

                <Button variant="outline" className="justify-between">
                  Show Shortcuts
                  <ShortcutBadge keyCombo={{ key: '?', shift: true }} />
                </Button>

                <Button variant="outline" className="justify-between">
                  Undo
                  <ShortcutBadge shortcutId="editing.undo" />
                </Button>

                <Button variant="outline" className="justify-between">
                  Redo
                  <ShortcutBadge shortcutId="editing.redo" />
                </Button>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={() => setHelpModalOpen(true)}
                  className="w-full"
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  View All Shortcuts
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Playback Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle>Playback Controls</CardTitle>
              <CardDescription>
                Control video playback with keyboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ShortcutHint shortcutId="playback.play-pause" />
              <ShortcutHint shortcutId="playback.rewind" />
              <ShortcutHint shortcutId="playback.forward" />
              <ShortcutHint shortcutId="playback.frame-back" />
              <ShortcutHint shortcutId="playback.frame-forward" />
              <ShortcutHint shortcutId="playback.jump-to-start" />
              <ShortcutHint shortcutId="playback.jump-to-end" />
            </CardContent>
          </Card>

          {/* Editing Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle>Editing Controls</CardTitle>
              <CardDescription>
                Edit clips on the timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ShortcutHint shortcutId="editing.cut" />
              <ShortcutHint shortcutId="editing.copy" />
              <ShortcutHint shortcutId="editing.paste" />
              <ShortcutHint shortcutId="editing.duplicate" />
              <ShortcutHint shortcutId="editing.delete" />
            </CardContent>
          </Card>

          {/* Timeline Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline Controls</CardTitle>
              <CardDescription>
                Navigate and manage the timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ShortcutHint shortcutId="timeline.zoom-in" />
              <ShortcutHint shortcutId="timeline.zoom-out" />
              <ShortcutHint shortcutId="timeline.toggle-snapping" />
              <ShortcutHint shortcutId="timeline.select-all" />
              <ShortcutHint shortcutId="timeline.deselect" />
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Centralized keyboard shortcuts management</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Support for multiple key combinations per action</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Customizable shortcuts with conflict detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Scope-based shortcuts (global, timeline, player)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Priority system for conflict resolution</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Searchable shortcuts help modal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Visual feedback with tooltips and badges</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>LocalStorage persistence for customizations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Import/Export shortcuts configuration</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customize">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Customize Shortcuts
              </CardTitle>
              <CardDescription>
                Click the edit button to customize any shortcut
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShortcutCustomizationPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ShortcutsHelpModal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
      />
    </div>
  );
};
