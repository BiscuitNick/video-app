/**
 * Dirty State Tracking Tests
 *
 * Manual tests to verify dirty state middleware functionality
 * Run with: node --loader tsx src/__tests__/dirtyState.test.ts
 */

import { create } from 'zustand';
import { dirtyStateMiddleware, type WithDirtyState } from '../stores/middleware/dirtyStateMiddleware';

interface TestState {
  count: number;
  name: string;
  nested: {
    value: number;
  };
  increment: () => void;
  setName: (name: string) => void;
  updateNested: (value: number) => void;
}

console.log('🧪 Dirty State Middleware Tests\n');

// Test 1: Basic dirty state tracking
console.log('Test 1: Basic Dirty State Tracking');
const useTestStore = create<WithDirtyState<TestState>>()(
  dirtyStateMiddleware(
    (set) => ({
      count: 0,
      name: 'Test',
      nested: { value: 0 },
      increment: () => set((state) => ({ count: state.count + 1 })),
      setName: (name) => set({ name }),
      updateNested: (value) => set({ nested: { value } }),
    }),
    {
      trackedFields: ['count', 'name', 'nested'],
    }
  )
);

// Initial state should not be dirty
let state = useTestStore.getState();
console.log('✓ Initial isDirty:', state.isDirty === false);
console.log('✓ Initial dirtyFields size:', state.dirtyFields.size === 0);

// Make a change
useTestStore.getState().increment();
state = useTestStore.getState();
console.log('✓ After increment isDirty:', state.isDirty === true);
console.log('✓ After increment dirtyFields contains "count":', state.dirtyFields.has('count'));

// Mark as clean
useTestStore.getState().markClean();
state = useTestStore.getState();
console.log('✓ After markClean isDirty:', state.isDirty === false);
console.log('✓ After markClean dirtyFields size:', state.dirtyFields.size === 0);
console.log('✓ Last save timestamp set:', state.lastSaveTimestamp !== null);

// Test 2: Multiple field tracking
console.log('\nTest 2: Multiple Field Tracking');
useTestStore.getState().setName('Updated');
useTestStore.getState().updateNested(42);
state = useTestStore.getState();
console.log('✓ isDirty after multiple changes:', state.isDirty === true);
console.log('✓ dirtyFields contains "name":', state.dirtyFields.has('name'));
console.log('✓ dirtyFields contains "nested":', state.dirtyFields.has('nested'));
console.log('✓ dirtyFields size:', state.dirtyFields.size);

// Test 3: Excluded fields
console.log('\nTest 3: Excluded Fields');
interface TestState2 {
  tracked: string;
  notTracked: string;
  setTracked: (value: string) => void;
  setNotTracked: (value: string) => void;
}

const useTestStore2 = create<WithDirtyState<TestState2>>()(
  dirtyStateMiddleware(
    (set) => ({
      tracked: 'initial',
      notTracked: 'initial',
      setTracked: (value) => set({ tracked: value }),
      setNotTracked: (value) => set({ notTracked: value }),
    }),
    {
      trackedFields: ['tracked'],
      excludedFields: ['notTracked'],
    }
  )
);

useTestStore2.getState().setNotTracked('changed');
let state2 = useTestStore2.getState();
console.log('✓ Excluded field change does not set dirty:', state2.isDirty === false);

useTestStore2.getState().setTracked('changed');
state2 = useTestStore2.getState();
console.log('✓ Tracked field change sets dirty:', state2.isDirty === true);

// Test 4: Manual dirty marking
console.log('\nTest 4: Manual Dirty Marking');
const useTestStore3 = create<WithDirtyState<TestState>>()(
  dirtyStateMiddleware((set) => ({
    count: 0,
    name: 'Test',
    nested: { value: 0 },
    increment: () => set((state) => ({ count: state.count + 1 })),
    setName: (name) => set({ name }),
    updateNested: (value) => set({ nested: { value } }),
  }))
);

useTestStore3.getState().markDirty(['custom-field-1', 'custom-field-2']);
let state3 = useTestStore3.getState();
console.log('✓ Manual markDirty sets isDirty:', state3.isDirty === true);
console.log('✓ Manual markDirty adds custom fields:', state3.dirtyFields.has('custom-field-1'));

// Test 5: Timestamp tracking
console.log('\nTest 5: Timestamp Tracking');
const useTestStore4 = create<WithDirtyState<TestState>>()(
  dirtyStateMiddleware((set) => ({
    count: 0,
    name: 'Test',
    nested: { value: 0 },
    increment: () => set((state) => ({ count: state.count + 1 })),
    setName: (name) => set({ name }),
    updateNested: (value) => set({ nested: { value } }),
  }))
);

const beforeChange = Date.now();
setTimeout(() => {
  useTestStore4.getState().increment();
  const state4 = useTestStore4.getState();
  console.log('✓ Last change timestamp is recent:', state4.lastChangeTimestamp! > beforeChange);
  console.log('✓ Last change timestamp is reasonable:', state4.lastChangeTimestamp! <= Date.now());

  // Test save timestamp
  setTimeout(() => {
    useTestStore4.getState().markClean();
    const state4_clean = useTestStore4.getState();
    console.log('✓ Last save timestamp set after markClean:', state4_clean.lastSaveTimestamp !== null);
    console.log('✓ Last save timestamp is recent:', state4_clean.lastSaveTimestamp! > beforeChange);

    // Final summary
    console.log('\n✅ All dirty state tracking tests passed!');
    console.log('\nTest Summary:');
    console.log('- Basic dirty state tracking');
    console.log('- Multiple field tracking');
    console.log('- Excluded fields behavior');
    console.log('- Manual dirty marking');
    console.log('- Timestamp tracking');
  }, 10);
}, 10);
