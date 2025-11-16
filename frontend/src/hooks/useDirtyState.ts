import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useTimelineStore } from '@/stores/useTimelineStore';

/**
 * Hook to check if the project has unsaved changes
 */
export const useProjectDirty = () => {
  const timelineIsDirty = useTimelineStore((state) => state.isDirty);
  const appIsDirty = useAppStore((state) => state.isDirty);

  return timelineIsDirty || appIsDirty;
};

/**
 * Hook to get all dirty fields across stores
 */
export const useDirtyFields = () => {
  const timelineDirtyFields = useTimelineStore((state) => state.dirtyFields);
  const appDirtyFields = useAppStore((state) => state.dirtyFields);

  return {
    timeline: Array.from(timelineDirtyFields || []),
    app: Array.from(appDirtyFields || []),
  };
};

/**
 * Hook to mark all stores as clean after save
 */
export const useMarkAllClean = () => {
  const markTimelineClean = useTimelineStore((state) => state.markClean);
  const markAppClean = useAppStore((state) => state.markClean);

  return useCallback(() => {
    markTimelineClean?.();
    markAppClean?.();
  }, [markTimelineClean, markAppClean]);
};

/**
 * Hook to get last change timestamp across all stores
 */
export const useLastChangeTimestamp = () => {
  const timelineLastChange = useTimelineStore((state) => state.lastChangeTimestamp);
  const appLastChange = useAppStore((state) => state.lastChangeTimestamp);

  if (!timelineLastChange && !appLastChange) return null;
  if (!timelineLastChange) return appLastChange;
  if (!appLastChange) return timelineLastChange;

  return Math.max(timelineLastChange, appLastChange);
};

/**
 * Hook to warn user before leaving page with unsaved changes
 */
export const useUnsavedChangesWarning = (enabled: boolean = true) => {
  const isDirty = useProjectDirty();

  useEffect(() => {
    if (!enabled || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue to be set
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, isDirty]);

  return isDirty;
};

/**
 * Hook to subscribe to dirty state changes
 */
export const useDirtyStateSubscription = (
  callback: (isDirty: boolean, fields: string[]) => void
) => {
  const isDirty = useProjectDirty();
  const dirtyFields = useDirtyFields();

  useEffect(() => {
    const allFields = [...dirtyFields.timeline, ...dirtyFields.app];
    callback(isDirty, allFields);
  }, [isDirty, callback, dirtyFields]);
};
