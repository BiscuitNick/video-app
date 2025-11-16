import { useMemo } from 'react';
import { keyboardShortcutsManager } from '@/services/keyboardShortcutsManager';
import { Badge } from '@/components/ui/badge';
import type { KeyCombo } from '@/types/shortcuts';

interface ShortcutTooltipProps {
  shortcutId?: string;
  keyCombo?: KeyCombo;
  children: React.ReactNode;
  className?: string;
}

/**
 * Component that shows a keyboard shortcut hint
 *
 * Usage:
 * <ShortcutTooltip shortcutId="playback.play-pause">
 *   <Button>Play</Button>
 * </ShortcutTooltip>
 */
export const ShortcutTooltip = ({
  shortcutId,
  keyCombo,
  children,
  className,
}: ShortcutTooltipProps) => {
  const shortcutText = useMemo(() => {
    if (keyCombo) {
      return keyboardShortcutsManager.formatKeyCombo(keyCombo);
    }

    if (shortcutId) {
      const shortcut = keyboardShortcutsManager.get(shortcutId);
      if (shortcut) {
        const keys = shortcut.customKeys || shortcut.defaultKeys;
        return keyboardShortcutsManager.formatKeyCombo(keys[0]);
      }
    }

    return null;
  }, [shortcutId, keyCombo]);

  if (!shortcutText) {
    return <>{children}</>;
  }

  return (
    <div className={className} title={shortcutText}>
      {children}
    </div>
  );
};

interface ShortcutBadgeProps {
  shortcutId?: string;
  keyCombo?: KeyCombo;
  className?: string;
}

/**
 * Component that displays a keyboard shortcut as a badge
 *
 * Usage:
 * <Button>
 *   Play <ShortcutBadge shortcutId="playback.play-pause" />
 * </Button>
 */
export const ShortcutBadge = ({
  shortcutId,
  keyCombo,
  className,
}: ShortcutBadgeProps) => {
  const shortcutText = useMemo(() => {
    if (keyCombo) {
      return keyboardShortcutsManager.formatKeyCombo(keyCombo);
    }

    if (shortcutId) {
      const shortcut = keyboardShortcutsManager.get(shortcutId);
      if (shortcut) {
        const keys = shortcut.customKeys || shortcut.defaultKeys;
        return keyboardShortcutsManager.formatKeyCombo(keys[0]);
      }
    }

    return null;
  }, [shortcutId, keyCombo]);

  if (!shortcutText) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={`font-mono text-xs ml-2 ${className}`}
    >
      {shortcutText}
    </Badge>
  );
};

interface ShortcutHintProps {
  shortcutId?: string;
  keyCombo?: KeyCombo;
  description?: string;
  className?: string;
}

/**
 * Component that displays a full shortcut hint with description
 *
 * Usage:
 * <ShortcutHint
 *   shortcutId="playback.play-pause"
 *   description="Toggle playback"
 * />
 */
export const ShortcutHint = ({
  shortcutId,
  keyCombo,
  description,
  className,
}: ShortcutHintProps) => {
  const shortcutData = useMemo(() => {
    if (shortcutId) {
      const shortcut = keyboardShortcutsManager.get(shortcutId);
      if (shortcut) {
        const keys = shortcut.customKeys || shortcut.defaultKeys;
        return {
          text: keyboardShortcutsManager.formatKeyCombo(keys[0]),
          description: description || shortcut.description,
        };
      }
    }

    if (keyCombo) {
      return {
        text: keyboardShortcutsManager.formatKeyCombo(keyCombo),
        description: description || '',
      };
    }

    return null;
  }, [shortcutId, keyCombo, description]);

  if (!shortcutData) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <Badge variant="secondary" className="font-mono text-xs">
        {shortcutData.text}
      </Badge>
      {shortcutData.description && (
        <span className="text-muted-foreground">{shortcutData.description}</span>
      )}
    </div>
  );
};
