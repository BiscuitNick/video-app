import { useEffect, useCallback, useState } from 'react';
import { keyboardShortcutsManager } from '@/services/keyboardShortcutsManager';
import type {
  ShortcutDefinition,
  ShortcutScope,
  ShortcutCategory,
  ShortcutConflict,
} from '@/types/shortcuts';

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  scope?: ShortcutScope;
}

interface UseKeyboardShortcutsReturn {
  shortcuts: ShortcutDefinition[];
  conflicts: ShortcutConflict[];
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  setScope: (scope: ShortcutScope) => void;
  getByCategory: (category: ShortcutCategory) => ShortcutDefinition[];
  formatKeyCombo: (combo: ShortcutDefinition['defaultKeys'][0]) => string;
}

/**
 * Hook to use keyboard shortcuts in a component
 *
 * @param options - Configuration options
 * @returns Shortcuts utilities
 */
export const useKeyboardShortcuts = (
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn => {
  const { enabled = true, scope } = options;
  const [forceUpdate, setForceUpdate] = useState(0);

  // Start/stop listening when component mounts/unmounts
  useEffect(() => {
    keyboardShortcutsManager.startListening();

    return () => {
      keyboardShortcutsManager.stopListening();
    };
  }, []);

  // Update enabled state
  useEffect(() => {
    keyboardShortcutsManager.setEnabled(enabled);
  }, [enabled]);

  // Update scope if provided
  useEffect(() => {
    if (scope) {
      keyboardShortcutsManager.setScope(scope);
    }
  }, [scope]);

  const setEnabled = useCallback((enabled: boolean) => {
    keyboardShortcutsManager.setEnabled(enabled);
    setForceUpdate(prev => prev + 1);
  }, []);

  const setScope = useCallback((scope: ShortcutScope) => {
    keyboardShortcutsManager.setScope(scope);
    setForceUpdate(prev => prev + 1);
  }, []);

  const getByCategory = useCallback((category: ShortcutCategory) => {
    return keyboardShortcutsManager.getByCategory(category);
  }, [forceUpdate]);

  const formatKeyCombo = useCallback(
    (combo: ShortcutDefinition['defaultKeys'][0]) => {
      return keyboardShortcutsManager.formatKeyCombo(combo);
    },
    []
  );

  return {
    shortcuts: keyboardShortcutsManager.getAll(),
    conflicts: keyboardShortcutsManager.getConflicts(),
    enabled: keyboardShortcutsManager.isEnabled(),
    setEnabled,
    setScope,
    getByCategory,
    formatKeyCombo,
  };
};

/**
 * Hook to register shortcuts when component mounts
 *
 * @param shortcuts - Shortcuts to register
 */
export const useRegisterShortcuts = (shortcuts: ShortcutDefinition[]): void => {
  useEffect(() => {
    keyboardShortcutsManager.registerMany(shortcuts);

    return () => {
      shortcuts.forEach(shortcut => {
        keyboardShortcutsManager.unregister(shortcut.id);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * Hook to register a single shortcut
 *
 * @param shortcut - Shortcut to register
 */
export const useRegisterShortcut = (shortcut: ShortcutDefinition): void => {
  useEffect(() => {
    keyboardShortcutsManager.register(shortcut);

    return () => {
      keyboardShortcutsManager.unregister(shortcut.id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
