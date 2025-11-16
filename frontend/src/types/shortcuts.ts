// Keyboard shortcuts types

export type ShortcutCategory =
  | 'playback'
  | 'editing'
  | 'timeline'
  | 'view'
  | 'tools'
  | 'navigation';

export type ShortcutScope =
  | 'global'
  | 'timeline'
  | 'player'
  | 'modal';

export interface KeyCombo {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: ShortcutCategory;
  scope: ShortcutScope;
  defaultKeys: KeyCombo[];
  customKeys?: KeyCombo[];
  action: () => void;
  enabled?: boolean;
  priority?: number; // Higher priority shortcuts take precedence in conflicts
  allowInInputs?: boolean; // Allow execution when focused on input elements
}

export interface ShortcutGroup {
  category: ShortcutCategory;
  label: string;
  shortcuts: ShortcutDefinition[];
}

export interface ShortcutConflict {
  shortcut1: ShortcutDefinition;
  shortcut2: ShortcutDefinition;
  keyCombo: KeyCombo;
}

export interface KeyboardShortcutsState {
  shortcuts: Map<string, ShortcutDefinition>;
  customizations: Map<string, KeyCombo[]>;
  enabled: boolean;
  conflicts: ShortcutConflict[];
}

// Helper type for building shortcuts
export type ShortcutBuilder = Omit<ShortcutDefinition, 'action'> & {
  action?: () => void;
};

// Preset shortcut layouts (for different editing styles)
export type ShortcutPreset =
  | 'default'
  | 'premiere-pro'
  | 'final-cut'
  | 'davinci-resolve'
  | 'custom';

export interface ShortcutPresetDefinition {
  id: ShortcutPreset;
  name: string;
  description: string;
  shortcuts: Partial<Record<string, KeyCombo[]>>;
}
