import { useState, useCallback, useEffect } from 'react';
import { Edit2, RotateCcw, Check, X, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { Badge } from './badge';
import { keyboardShortcutsManager } from '@/services/keyboardShortcutsManager';
import type { ShortcutDefinition, KeyCombo } from '@/types/shortcuts';
import { cn } from '@/lib/utils';

interface ShortcutEditorProps {
  shortcut: ShortcutDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export const ShortcutEditor = ({
  shortcut,
  open,
  onOpenChange,
  onSave,
}: ShortcutEditorProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<KeyCombo[]>([]);
  const [currentRecording, setCurrentRecording] = useState<KeyCombo | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  useEffect(() => {
    if (shortcut && open) {
      // Load current keys when opening
      const currentKeys = shortcut.customKeys || shortcut.defaultKeys;
      setRecordedKeys([...currentKeys]);
      setConflicts([]);
    }
  }, [shortcut, open]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Ignore modifier-only keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      return;
    }

    const keyCombo: KeyCombo = {
      key: event.key,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
    };

    setCurrentRecording(keyCombo);
  }, []);

  const handleKeyUp = useCallback(() => {
    if (currentRecording) {
      // Add the recorded key combo
      setRecordedKeys(prev => {
        // Check if this exact combo already exists
        const exists = prev.some(
          combo =>
            combo.key === currentRecording.key &&
            combo.ctrl === currentRecording.ctrl &&
            combo.shift === currentRecording.shift &&
            combo.alt === currentRecording.alt &&
            combo.meta === currentRecording.meta
        );

        if (exists) {
          return prev;
        }

        return [...prev, currentRecording];
      });

      setCurrentRecording(null);
      setIsRecording(false);

      // Check for conflicts
      checkConflicts([...recordedKeys, currentRecording]);
    }
  }, [currentRecording, recordedKeys]);

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isRecording, handleKeyDown, handleKeyUp]);

  const checkConflicts = (keys: KeyCombo[]) => {
    if (!shortcut) return;

    // Create a temporary shortcut with the new keys
    const tempShortcut = {
      ...shortcut,
      customKeys: keys,
    };

    // Find conflicts
    const conflictingShortcuts: string[] = [];
    const allShortcuts = keyboardShortcutsManager.getAll();

    for (const otherShortcut of allShortcuts) {
      if (otherShortcut.id === shortcut.id) continue;

      const otherKeys = otherShortcut.customKeys || otherShortcut.defaultKeys;

      for (const keyCombo of keys) {
        for (const otherKeyCombo of otherKeys) {
          if (keyComboEquals(keyCombo, otherKeyCombo)) {
            // Check if scopes overlap
            if (
              tempShortcut.scope === otherShortcut.scope ||
              tempShortcut.scope === 'global' ||
              otherShortcut.scope === 'global'
            ) {
              conflictingShortcuts.push(otherShortcut.name);
            }
          }
        }
      }
    }

    setConflicts(conflictingShortcuts);
  };

  const keyComboEquals = (combo1: KeyCombo, combo2: KeyCombo): boolean => {
    return (
      combo1.key.toLowerCase() === combo2.key.toLowerCase() &&
      (combo1.ctrl || false) === (combo2.ctrl || false) &&
      (combo1.shift || false) === (combo2.shift || false) &&
      (combo1.alt || false) === (combo2.alt || false) &&
      (combo1.meta || false) === (combo2.meta || false)
    );
  };

  const startRecording = () => {
    setIsRecording(true);
    setCurrentRecording(null);
  };

  const removeKey = (index: number) => {
    const newKeys = recordedKeys.filter((_, i) => i !== index);
    setRecordedKeys(newKeys);
    checkConflicts(newKeys);
  };

  const resetToDefault = () => {
    if (!shortcut) return;
    setRecordedKeys([...shortcut.defaultKeys]);
    setConflicts([]);
  };

  const handleSave = () => {
    if (!shortcut) return;

    if (recordedKeys.length === 0) {
      alert('Please add at least one key combination');
      return;
    }

    // Save the customization
    keyboardShortcutsManager.customize(shortcut.id, recordedKeys);

    onSave?.();
    onOpenChange(false);
  };

  const formatKeyCombo = (combo: KeyCombo): string => {
    return keyboardShortcutsManager.formatKeyCombo(combo);
  };

  if (!shortcut) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            Edit Shortcut
          </DialogTitle>
          <DialogDescription>
            Customize keyboard shortcut for: <strong>{shortcut.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Keys */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Key Combinations
            </label>
            <div className="flex flex-wrap gap-2 mb-2 min-h-[40px] p-2 border rounded-md">
              {recordedKeys.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No keys assigned
                </span>
              ) : (
                recordedKeys.map((keyCombo, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="font-mono text-xs px-2 py-1 flex items-center gap-1"
                  >
                    {formatKeyCombo(keyCombo)}
                    <button
                      onClick={() => removeKey(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={startRecording}
                disabled={isRecording}
                variant={isRecording ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
              >
                {isRecording ? (
                  <>
                    <span className="animate-pulse">Press a key...</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="h-3 w-3 mr-1" />
                    Add Key Combo
                  </>
                )}
              </Button>

              <Button
                onClick={resetToDefault}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>

            {currentRecording && (
              <div className="mt-2 p-2 bg-accent rounded-md text-sm">
                Recording: <Badge variant="secondary" className="font-mono ml-1">
                  {formatKeyCombo(currentRecording)}
                </Badge>
              </div>
            )}
          </div>

          {/* Default Keys */}
          <div>
            <label className="text-sm font-medium mb-2 block text-muted-foreground">
              Default Keys
            </label>
            <div className="flex flex-wrap gap-2">
              {shortcut.defaultKeys.map((keyCombo, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="font-mono text-xs"
                >
                  {formatKeyCombo(keyCombo)}
                </Badge>
              ))}
            </div>
          </div>

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-destructive">
                    Conflicts detected
                  </p>
                  <p className="text-muted-foreground mt-1">
                    This shortcut conflicts with: {conflicts.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Shortcut Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Scope:</strong> {shortcut.scope}
            </p>
            <p>
              <strong>Category:</strong> {shortcut.category}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={recordedKeys.length === 0}>
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ShortcutCustomizationPanelProps {
  className?: string;
}

/**
 * Panel for managing all keyboard shortcuts
 */
export const ShortcutCustomizationPanel = ({
  className,
}: ShortcutCustomizationPanelProps) => {
  const [editingShortcut, setEditingShortcut] = useState<ShortcutDefinition | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>([]);

  useEffect(() => {
    loadShortcuts();
  }, []);

  const loadShortcuts = () => {
    setShortcuts(keyboardShortcutsManager.getAll());
  };

  const handleEdit = (shortcut: ShortcutDefinition) => {
    setEditingShortcut(shortcut);
  };

  const handleSave = () => {
    loadShortcuts();
  };

  const handleResetAll = () => {
    if (confirm('Reset all shortcuts to defaults?')) {
      keyboardShortcutsManager.resetAllToDefaults();
      loadShortcuts();
    }
  };

  const formatKeyCombo = (combo: KeyCombo): string => {
    return keyboardShortcutsManager.formatKeyCombo(combo);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
        <Button onClick={handleResetAll} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset All
        </Button>
      </div>

      <div className="space-y-2">
        {shortcuts.map(shortcut => {
          const keys = shortcut.customKeys || shortcut.defaultKeys;

          return (
            <div
              key={shortcut.id}
              className="flex items-center justify-between p-3 border rounded-md hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{shortcut.name}</div>
                <div className="text-xs text-muted-foreground">
                  {shortcut.description}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {keys.map((keyCombo, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="font-mono text-xs"
                    >
                      {formatKeyCombo(keyCombo)}
                    </Badge>
                  ))}
                </div>

                <Button
                  onClick={() => handleEdit(shortcut)}
                  variant="ghost"
                  size="sm"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ShortcutEditor
        shortcut={editingShortcut}
        open={editingShortcut !== null}
        onOpenChange={(open) => !open && setEditingShortcut(null)}
        onSave={handleSave}
      />
    </div>
  );
};
