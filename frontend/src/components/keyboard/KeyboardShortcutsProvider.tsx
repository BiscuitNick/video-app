import { useEffect, useState } from 'react';
import { useRegisterShortcuts } from '@/hooks/useKeyboardShortcuts';
import { getAllDefaultShortcuts } from '@/config/defaultShortcuts';
import { ShortcutsHelpModal } from '@/components/ui/ShortcutsHelpModal';
import { keyboardShortcutsManager } from '@/services/keyboardShortcutsManager';
import type { ShortcutDefinition } from '@/types/shortcuts';

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that sets up all keyboard shortcuts for the application
 *
 * This component:
 * - Registers all default shortcuts
 * - Handles the help modal (triggered by '?')
 * - Provides visual feedback for shortcuts
 */
export const KeyboardShortcutsProvider = ({
  children,
}: KeyboardShortcutsProviderProps) => {
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Register all default shortcuts
  const allShortcuts = getAllDefaultShortcuts();
  useRegisterShortcuts(allShortcuts);

  // Register the help shortcut separately (it opens the modal)
  useEffect(() => {
    const helpShortcut: ShortcutDefinition = {
      id: 'help.show-shortcuts',
      name: 'Show Shortcuts',
      description: 'Open keyboard shortcuts help',
      category: 'view',
      scope: 'global',
      priority: 100,
      defaultKeys: [
        { key: '?', shift: true },
        { key: '/', shift: true },
      ],
      action: () => {
        setHelpModalOpen(true);
      },
      allowInInputs: false,
    };

    keyboardShortcutsManager.register(helpShortcut);

    return () => {
      keyboardShortcutsManager.unregister(helpShortcut.id);
    };
  }, []);

  return (
    <>
      {children}
      <ShortcutsHelpModal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
      />
    </>
  );
};
