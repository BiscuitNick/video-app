import React, { useState } from 'react';
import { Play, Edit, Trash, Share, Download, Scissors, Image, Video, Music } from 'lucide-react';
import {
  BottomSheet,
  ActionSheet,
  type ActionSheetOption,
  CollapsiblePanel,
  StackedPanelLayout,
  TimelineMobile,
  PlaybackControls,
  GestureControls,
  ClipTrimmer,
  AssetBrowserMobile,
  OrientationLock,
  OrientationWarning,
  MobileOnboarding,
  useOnboardingStatus,
} from './index';
import { cn } from '@/lib/utils';

export const MobileDemo: React.FC = () => {
  // Bottom Sheet state
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // Action Sheet state
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Demo states
  const [activeDemo, setActiveDemo] = useState<
    'ui' | 'timeline' | 'controls' | 'assets' | 'onboarding' | null
  >('ui');

  // Onboarding
  const { isCompleted, resetOnboarding } = useOnboardingStatus();
  const [showOnboarding, setShowOnboarding] = useState(!isCompleted);

  // Demo data
  const mockClip = {
    id: 'clip-1',
    name: 'Sample Video Clip',
    startTime: 5,
    endTime: 15,
    trackId: 'track-1',
    assetId: 'asset-1',
  };

  const mockAssets = [
    {
      id: '1',
      name: 'Intro Video.mp4',
      type: 'video' as const,
      size: 25600000,
      duration: 45,
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Background Music.mp3',
      type: 'audio' as const,
      size: 5120000,
      duration: 180,
      createdAt: new Date(),
    },
    {
      id: '3',
      name: 'Logo.png',
      type: 'image' as const,
      size: 102400,
      createdAt: new Date(),
    },
    {
      id: '4',
      name: 'Scene 1.mp4',
      type: 'video' as const,
      size: 45600000,
      duration: 60,
      createdAt: new Date(),
    },
    {
      id: '5',
      name: 'Overlay.png',
      type: 'image' as const,
      size: 204800,
      createdAt: new Date(),
    },
    {
      id: '6',
      name: 'Narration.mp3',
      type: 'audio' as const,
      size: 8192000,
      duration: 120,
      createdAt: new Date(),
    },
  ];

  const actionSheetOptions: ActionSheetOption[] = [
    {
      label: 'Edit',
      icon: <Edit className="w-5 h-5" />,
      onSelect: () => console.log('Edit selected'),
    },
    {
      label: 'Share',
      icon: <Share className="w-5 h-5" />,
      onSelect: () => console.log('Share selected'),
    },
    {
      label: 'Download',
      icon: <Download className="w-5 h-5" />,
      onSelect: () => console.log('Download selected'),
    },
    {
      label: 'Delete',
      icon: <Trash className="w-5 h-5" />,
      onSelect: () => console.log('Delete selected'),
      variant: 'destructive',
    },
  ];

  const onboardingSteps = [
    {
      title: 'Welcome to Mobile Video Editor',
      description:
        'Create professional videos on your mobile device with intuitive touch controls.',
      illustration: <Video className="w-32 h-32 text-blue-500" />,
    },
    {
      title: 'Touch Gestures',
      description:
        'Use pinch to zoom, swipe to scroll, and two-finger tap to split clips.',
      illustration: <span className="text-8xl">👆</span>,
    },
    {
      title: 'Timeline Editing',
      description:
        'Drag clips, trim with precision, and arrange your story with ease.',
      illustration: <Scissors className="w-32 h-32 text-green-500" />,
    },
    {
      title: "You're All Set!",
      description:
        "You're ready to start creating. Tap below to begin your first project.",
      illustration: <span className="text-8xl">🎬</span>,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Onboarding */}
      {showOnboarding && (
        <MobileOnboarding
          steps={onboardingSteps}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* Main Content */}
      <div className="safe-top">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
          <h1 className="mobile-text-lg font-bold text-zinc-100">
            Mobile Components Demo
          </h1>
          <OrientationLock />
        </div>

        {/* Demo Tabs */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-zinc-800/50">
          {[
            { key: 'ui', label: 'UI Patterns' },
            { key: 'timeline', label: 'Timeline' },
            { key: 'controls', label: 'Controls' },
            { key: 'assets', label: 'Assets' },
            { key: 'onboarding', label: 'Onboarding' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveDemo(tab.key as typeof activeDemo)}
              className={cn(
                'touch-target-min px-4 py-2 rounded-lg whitespace-nowrap mobile-text-sm font-medium transition-colors',
                activeDemo === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Demo Content */}
        <div className="p-4">
          {/* UI Patterns Demo */}
          {activeDemo === 'ui' && (
            <StackedPanelLayout spacing="normal">
              <CollapsiblePanel
                title="Bottom Sheet Example"
                icon={<Play className="w-5 h-5" />}
                defaultOpen
              >
                <button
                  onClick={() => setShowBottomSheet(true)}
                  className="touch-target w-full bg-blue-600 text-white rounded-lg py-3 mobile-text-base font-medium"
                >
                  Show Bottom Sheet
                </button>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Action Sheet Example"
                icon={<Edit className="w-5 h-5" />}
                badge="4"
              >
                <button
                  onClick={() => setShowActionSheet(true)}
                  className="touch-target w-full bg-green-600 text-white rounded-lg py-3 mobile-text-base font-medium"
                >
                  Show Action Sheet
                </button>
              </CollapsiblePanel>

              <CollapsiblePanel title="Collapsible Panel" icon={<Scissors className="w-5 h-5" />}>
                <p className="mobile-text-sm text-zinc-300">
                  This is a collapsible panel with smooth animations. Long press
                  to feel the haptic feedback!
                </p>
              </CollapsiblePanel>

              <CollapsiblePanel title="Utilities" icon={<Video className="w-5 h-5" />}>
                <div className="space-y-2">
                  <button
                    onClick={resetOnboarding}
                    className="touch-target-min w-full bg-zinc-700 text-zinc-200 rounded py-2 mobile-text-sm"
                  >
                    Reset Onboarding
                  </button>
                </div>
              </CollapsiblePanel>
            </StackedPanelLayout>
          )}

          {/* Timeline Demo */}
          {activeDemo === 'timeline' && (
            <div className="bg-zinc-800 rounded-lg overflow-hidden" style={{ height: '500px' }}>
              <TimelineMobile />
            </div>
          )}

          {/* Controls Demo */}
          {activeDemo === 'controls' && (
            <StackedPanelLayout spacing="relaxed">
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="mobile-text-base font-semibold text-zinc-100 mb-4">
                  Playback Controls
                </h3>
                <PlaybackControls size="large" />
              </div>

              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="mobile-text-base font-semibold text-zinc-100 mb-4">
                  Clip Trimmer
                </h3>
                <ClipTrimmer
                  clip={mockClip}
                  onTrim={(id, start, end) =>
                    console.log('Trimmed:', id, start, end)
                  }
                />
              </div>

              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="mobile-text-base font-semibold text-zinc-100 mb-4">
                  Gesture Controls
                </h3>
                <GestureControls
                  onSplit={(time) => console.log('Split at:', time)}
                >
                  <div className="h-48 bg-zinc-700 rounded-lg flex items-center justify-center">
                    <p className="mobile-text-sm text-zinc-400 text-center px-4">
                      Double-tap to play/pause
                      <br />
                      Two-finger tap to split
                      <br />
                      Two-finger drag to scrub
                    </p>
                  </div>
                </GestureControls>
              </div>
            </StackedPanelLayout>
          )}

          {/* Assets Demo */}
          {activeDemo === 'assets' && (
            <div className="bg-zinc-800 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <AssetBrowserMobile
                assets={mockAssets}
                onAssetSelect={(asset) => console.log('Selected:', asset)}
                onBatchSelect={(assets) => console.log('Batch selected:', assets)}
              />
            </div>
          )}

          {/* Onboarding Demo */}
          {activeDemo === 'onboarding' && (
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="mobile-text-base font-semibold text-zinc-100 mb-4">
                  Onboarding Flow
                </h3>
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="touch-target w-full bg-blue-600 text-white rounded-lg py-3 mobile-text-base font-medium"
                >
                  Show Onboarding
                </button>
              </div>

              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="mobile-text-base font-semibold text-zinc-100 mb-4">
                  Orientation Warning
                </h3>
                <p className="mobile-text-sm text-zinc-400 mb-3">
                  The orientation warning appears when device orientation doesn't
                  match the preferred orientation.
                </p>
                <OrientationWarning preferredOrientation="landscape" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={showBottomSheet}
        onClose={() => setShowBottomSheet(false)}
        title="Bottom Sheet Demo"
        snapPoints={[40, 70, 100]}
        initialSnap={1}
      >
        <div className="space-y-4">
          <p className="mobile-text-base text-zinc-300">
            This is a bottom sheet with drag-to-dismiss functionality. Try
            dragging the handle or the sheet itself to dismiss it!
          </p>
          <p className="mobile-text-sm text-zinc-400">
            You can snap it to different heights by dragging it up or down.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-zinc-700 rounded-lg flex items-center justify-center"
              >
                <span className="mobile-text-sm text-zinc-400">Item {i}</span>
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* Action Sheet */}
      <ActionSheet
        isOpen={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        title="Choose an action"
        description="Select an option from the list below"
        options={actionSheetOptions}
      />
    </div>
  );
};
