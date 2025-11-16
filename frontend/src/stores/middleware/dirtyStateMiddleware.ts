import { StateCreator, StoreMutatorIdentifier } from 'zustand';

export interface DirtyState {
  isDirty: boolean;
  dirtyFields: Set<string>;
  lastSaveTimestamp: number | null;
  lastChangeTimestamp: number | null;
}

export interface DirtyStateActions {
  markClean: () => void;
  markDirty: (fields: string[]) => void;
  getDirtyState: () => DirtyState;
  resetDirtyState: () => void;
}

type DirtyStateMiddleware = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>,
  options?: DirtyStateOptions
) => StateCreator<T & DirtyState & DirtyStateActions, Mps, Mcs>;

export interface DirtyStateOptions {
  // Fields to track for dirty state
  trackedFields?: string[];
  // Fields to exclude from dirty tracking
  excludedFields?: string[];
  // Whether to automatically mark dirty on any state change
  autoTrack?: boolean;
  // Custom equality function for deep comparison
  isEqual?: (a: unknown, b: unknown) => boolean;
}

type DirtyStateImpl = <T extends object>(
  config: StateCreator<T, [], []>,
  options?: DirtyStateOptions
) => StateCreator<T & DirtyState & DirtyStateActions, [], []>;

// Default deep equality check
const defaultIsEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!defaultIsEqual((a as any)[key], (b as any)[key])) return false;
  }

  return true;
};

// Helper to check if a field should be tracked
const shouldTrackField = (
  field: string,
  options: DirtyStateOptions
): boolean => {
  // Don't track internal dirty state fields
  if (['isDirty', 'dirtyFields', 'lastSaveTimestamp', 'lastChangeTimestamp', 'markClean', 'markDirty', 'getDirtyState', 'resetDirtyState'].includes(field)) {
    return false;
  }

  // Check excluded fields
  if (options.excludedFields?.includes(field)) {
    return false;
  }

  // If tracked fields specified, only track those
  if (options.trackedFields && options.trackedFields.length > 0) {
    return options.trackedFields.includes(field);
  }

  // By default, track if autoTrack is enabled
  return options.autoTrack ?? true;
};

export const dirtyStateMiddleware: DirtyStateImpl = (config, options = {}) => {
  return (set, get, api) => {
    const isEqual = options.isEqual ?? defaultIsEqual;

    // Initialize dirty state
    const initialDirtyState: DirtyState = {
      isDirty: false,
      dirtyFields: new Set<string>(),
      lastSaveTimestamp: null,
      lastChangeTimestamp: null,
    };

    const dirtyStateActions: DirtyStateActions = {
      markClean: () => {
        set({
          isDirty: false,
          dirtyFields: new Set<string>(),
          lastSaveTimestamp: Date.now(),
        } as Partial<DirtyState & DirtyStateActions>);
      },

      markDirty: (fields: string[]) => {
        const currentDirtyFields = new Set(get().dirtyFields);
        fields.forEach(field => currentDirtyFields.add(field));

        set({
          isDirty: true,
          dirtyFields: currentDirtyFields,
          lastChangeTimestamp: Date.now(),
        } as Partial<DirtyState & DirtyStateActions>);
      },

      getDirtyState: () => {
        const state = get();
        return {
          isDirty: state.isDirty,
          dirtyFields: state.dirtyFields,
          lastSaveTimestamp: state.lastSaveTimestamp,
          lastChangeTimestamp: state.lastChangeTimestamp,
        };
      },

      resetDirtyState: () => {
        set({
          isDirty: false,
          dirtyFields: new Set<string>(),
          lastSaveTimestamp: null,
          lastChangeTimestamp: null,
        } as Partial<DirtyState & DirtyStateActions>);
      },
    };

    // Wrap the set function to track changes
    const wrappedSet: typeof set = (partial, replace) => {
      const prevState = get();

      // Call the original set
      set(partial, replace);

      const nextState = get();

      // Detect changes
      const changedFields: string[] = [];

      for (const key in nextState) {
        if (!shouldTrackField(key, options)) continue;

        const prevValue = (prevState as any)[key];
        const nextValue = (nextState as any)[key];

        if (!isEqual(prevValue, nextValue)) {
          changedFields.push(key);
        }
      }

      // If there are changes, mark as dirty
      if (changedFields.length > 0) {
        dirtyStateActions.markDirty(changedFields);
      }
    };

    // Create the base state with config
    const baseState = config(wrappedSet, get, api);

    // Merge with dirty state
    return {
      ...baseState,
      ...initialDirtyState,
      ...dirtyStateActions,
    };
  };
};

// Type helper for stores using dirty state middleware
export type WithDirtyState<T> = T & DirtyState & DirtyStateActions;
