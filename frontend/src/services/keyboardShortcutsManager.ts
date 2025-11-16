import type {
  KeyCombo,
  ShortcutDefinition,
  ShortcutConflict,
  ShortcutCategory,
  ShortcutScope,
  ShortcutPreset,
  ShortcutPresetDefinition,
} from '@/types/shortcuts';

/**
 * KeyboardShortcutsManager - Centralized keyboard shortcuts management
 *
 * Features:
 * - Register/unregister shortcuts
 * - Handle keyboard events
 * - Detect and resolve conflicts
 * - Support custom user shortcuts
 * - Persist customizations to localStorage
 * - Support different scopes and priorities
 */
class KeyboardShortcutsManager {
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private customizations: Map<string, KeyCombo[]> = new Map();
  private listeners: Set<(event: KeyboardEvent) => void> = new Set();
  private enabled = true;
  private currentScope: ShortcutScope = 'global';

  // Storage key for persisting customizations
  private readonly STORAGE_KEY = 'chronos-keyboard-shortcuts';

  constructor() {
    this.loadCustomizations();
  }

  /**
   * Register a new keyboard shortcut
   */
  register(shortcut: ShortcutDefinition): void {
    // Check for conflicts before registering
    const conflicts = this.detectConflicts(shortcut);

    if (conflicts.length > 0) {
      console.warn(`Shortcut ${shortcut.id} has conflicts:`, conflicts);
    }

    this.shortcuts.set(shortcut.id, shortcut);
  }

  /**
   * Register multiple shortcuts at once
   */
  registerMany(shortcuts: ShortcutDefinition[]): void {
    shortcuts.forEach(shortcut => this.register(shortcut));
  }

  /**
   * Unregister a shortcut
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Get a shortcut by ID
   */
  get(id: string): ShortcutDefinition | undefined {
    return this.shortcuts.get(id);
  }

  /**
   * Get all shortcuts
   */
  getAll(): ShortcutDefinition[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getByCategory(category: ShortcutCategory): ShortcutDefinition[] {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * Get shortcuts by scope
   */
  getByScope(scope: ShortcutScope): ShortcutDefinition[] {
    return this.getAll().filter(s => s.scope === scope);
  }

  /**
   * Set the current scope (e.g., when focusing timeline vs player)
   */
  setScope(scope: ShortcutScope): void {
    this.currentScope = scope;
  }

  /**
   * Get the current scope
   */
  getScope(): ShortcutScope {
    return this.currentScope;
  }

  /**
   * Handle keyboard events
   */
  handleKeyEvent = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    // Don't handle if user is typing in an input (unless shortcut allows it)
    const isInputFocused =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable);

    // Find matching shortcuts
    const matchingShortcuts = this.findMatchingShortcuts(event);

    // Filter by scope and priority
    const applicableShortcuts = matchingShortcuts
      .filter(shortcut => {
        // Check if shortcut is enabled
        if (shortcut.enabled === false) return false;

        // Check if shortcut allows execution in inputs
        if (isInputFocused && !shortcut.allowInInputs) return false;

        // Check scope (global shortcuts work everywhere)
        if (shortcut.scope === 'global') return true;
        if (shortcut.scope === this.currentScope) return true;

        return false;
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)); // Higher priority first

    // Execute the highest priority matching shortcut
    if (applicableShortcuts.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      applicableShortcuts[0].action();
    }
  };

  /**
   * Find shortcuts that match the keyboard event
   */
  private findMatchingShortcuts(event: KeyboardEvent): ShortcutDefinition[] {
    const matches: ShortcutDefinition[] = [];

    for (const shortcut of this.shortcuts.values()) {
      const keys = this.getEffectiveKeys(shortcut);

      for (const keyCombo of keys) {
        if (this.matchesKeyCombo(event, keyCombo)) {
          matches.push(shortcut);
          break;
        }
      }
    }

    return matches;
  }

  /**
   * Get effective keys for a shortcut (custom or default)
   */
  private getEffectiveKeys(shortcut: ShortcutDefinition): KeyCombo[] {
    const customKeys = this.customizations.get(shortcut.id);
    return customKeys || shortcut.customKeys || shortcut.defaultKeys;
  }

  /**
   * Check if keyboard event matches a key combo
   */
  private matchesKeyCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
    // Normalize key comparison (case-insensitive)
    const eventKey = event.key.toLowerCase();
    const comboKey = combo.key.toLowerCase();

    if (eventKey !== comboKey) return false;

    // Check modifiers (ctrl/cmd, shift, alt)
    const ctrlPressed = event.ctrlKey || event.metaKey;
    const shiftPressed = event.shiftKey;
    const altPressed = event.altKey;

    const ctrlRequired = combo.ctrl || combo.meta || false;
    const shiftRequired = combo.shift || false;
    const altRequired = combo.alt || false;

    return (
      ctrlPressed === ctrlRequired &&
      shiftPressed === shiftRequired &&
      altPressed === altRequired
    );
  }

  /**
   * Detect conflicts with existing shortcuts
   */
  private detectConflicts(shortcut: ShortcutDefinition): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];
    const keys = this.getEffectiveKeys(shortcut);

    for (const [id, existingShortcut] of this.shortcuts) {
      if (id === shortcut.id) continue;

      const existingKeys = this.getEffectiveKeys(existingShortcut);

      for (const keyCombo of keys) {
        for (const existingKeyCombo of existingKeys) {
          if (this.keyComboEquals(keyCombo, existingKeyCombo)) {
            // Check if they have overlapping scopes
            if (
              shortcut.scope === existingShortcut.scope ||
              shortcut.scope === 'global' ||
              existingShortcut.scope === 'global'
            ) {
              conflicts.push({
                shortcut1: shortcut,
                shortcut2: existingShortcut,
                keyCombo,
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Get all current conflicts
   */
  getConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];

    for (const shortcut of this.shortcuts.values()) {
      conflicts.push(...this.detectConflicts(shortcut));
    }

    // Remove duplicates
    return conflicts.filter(
      (conflict, index, self) =>
        index ===
        self.findIndex(
          c =>
            c.shortcut1.id === conflict.shortcut1.id &&
            c.shortcut2.id === conflict.shortcut2.id
        )
    );
  }

  /**
   * Check if two key combos are equal
   */
  private keyComboEquals(combo1: KeyCombo, combo2: KeyCombo): boolean {
    return (
      combo1.key.toLowerCase() === combo2.key.toLowerCase() &&
      (combo1.ctrl || false) === (combo2.ctrl || false) &&
      (combo1.shift || false) === (combo2.shift || false) &&
      (combo1.alt || false) === (combo2.alt || false) &&
      (combo1.meta || false) === (combo2.meta || false)
    );
  }

  /**
   * Customize a shortcut's keys
   */
  customize(id: string, keys: KeyCombo[]): void {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) {
      console.warn(`Shortcut ${id} not found`);
      return;
    }

    this.customizations.set(id, keys);
    this.saveCustomizations();
  }

  /**
   * Reset a shortcut to default keys
   */
  resetToDefault(id: string): void {
    this.customizations.delete(id);
    this.saveCustomizations();
  }

  /**
   * Reset all shortcuts to defaults
   */
  resetAllToDefaults(): void {
    this.customizations.clear();
    this.saveCustomizations();
  }

  /**
   * Load a shortcut preset
   */
  loadPreset(preset: ShortcutPresetDefinition): void {
    this.customizations.clear();

    for (const [shortcutId, keys] of Object.entries(preset.shortcuts)) {
      if (keys) {
        this.customizations.set(shortcutId, keys);
      }
    }

    this.saveCustomizations();
  }

  /**
   * Save customizations to localStorage
   */
  private saveCustomizations(): void {
    try {
      const data = Array.from(this.customizations.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save keyboard shortcuts:', error);
    }
  }

  /**
   * Load customizations from localStorage
   */
  private loadCustomizations(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const entries = JSON.parse(data);
        this.customizations = new Map(entries);
      }
    } catch (error) {
      console.error('Failed to load keyboard shortcuts:', error);
    }
  }

  /**
   * Enable/disable all shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if shortcuts are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Start listening to keyboard events
   */
  startListening(): void {
    window.addEventListener('keydown', this.handleKeyEvent);
  }

  /**
   * Stop listening to keyboard events
   */
  stopListening(): void {
    window.removeEventListener('keydown', this.handleKeyEvent);
  }

  /**
   * Format a key combo as a human-readable string
   */
  formatKeyCombo(combo: KeyCombo): string {
    const parts: string[] = [];

    if (combo.ctrl || combo.meta) {
      parts.push(this.isMac() ? '⌘' : 'Ctrl');
    }
    if (combo.shift) {
      parts.push(this.isMac() ? '⇧' : 'Shift');
    }
    if (combo.alt) {
      parts.push(this.isMac() ? '⌥' : 'Alt');
    }

    // Format the key nicely
    const key = this.formatKey(combo.key);
    parts.push(key);

    return parts.join(this.isMac() ? '' : '+');
  }

  /**
   * Format a key for display
   */
  private formatKey(key: string): string {
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      'arrowleft': '←',
      'arrowright': '→',
      'arrowup': '↑',
      'arrowdown': '↓',
      'escape': 'Esc',
      'delete': 'Del',
      'backspace': '⌫',
      'enter': '↵',
      'tab': '⇥',
      '`': '`',
    };

    const lowerKey = key.toLowerCase();
    return keyMap[lowerKey] || key.toUpperCase();
  }

  /**
   * Check if running on macOS
   */
  private isMac(): boolean {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }

  /**
   * Export customizations as JSON
   */
  exportCustomizations(): string {
    const data = Object.fromEntries(this.customizations);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import customizations from JSON
   */
  importCustomizations(json: string): void {
    try {
      const data = JSON.parse(json);
      this.customizations = new Map(Object.entries(data));
      this.saveCustomizations();
    } catch (error) {
      console.error('Failed to import keyboard shortcuts:', error);
      throw new Error('Invalid shortcuts JSON');
    }
  }
}

// Singleton instance
export const keyboardShortcutsManager = new KeyboardShortcutsManager();
