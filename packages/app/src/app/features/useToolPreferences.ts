import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolOperation } from "../../contracts/tool-operation.ts";
import {
  createToolPreferences,
  loadToolPreferences,
  saveToolPreferences,
  setToolEnabled,
  type ToolPreferences,
} from "./tool-preference-storage.ts";

export interface ToolPreferencesController {
  readonly enabled: readonly ToolOperation[];
  readonly setEnabled: (operation: ToolOperation, enabled: boolean) => void;
  readonly reset: () => boolean;
}

export const useToolPreferences = (
  onWarning: (message: string) => void,
): ToolPreferencesController => {
  const [load] = useState(loadToolPreferences);
  const [preferences, setPreferences] = useState(load.preferences);
  const preferencesRef = useRef(preferences);
  const protectedRef = useRef(!load.ok && load.reason !== "unavailable");

  useEffect(() => {
    if (load.ok && load.source === "created") saveToolPreferences(load.preferences);
    if (!load.ok) onWarning("Tool preferences could not be loaded; changes stay in this session.");
  }, [load, onWarning]);

  const replace = useCallback(
    (next: ToolPreferences, replaceProtected: boolean): boolean => {
      const persisted = (!protectedRef.current || replaceProtected) && saveToolPreferences(next);
      if (!persisted && (!protectedRef.current || replaceProtected)) {
        onWarning("Tool preferences could not be saved; changes stay in this session.");
      }
      if (replaceProtected) protectedRef.current = false;
      preferencesRef.current = next;
      setPreferences(next);
      return persisted;
    },
    [onWarning],
  );

  const setEnabled = useCallback(
    (operation: ToolOperation, enabled: boolean): void => {
      replace(setToolEnabled(preferencesRef.current, operation, enabled), false);
    },
    [replace],
  );

  const reset = useCallback((): boolean => replace(createToolPreferences(), true), [replace]);

  return { enabled: preferences.enabled, setEnabled, reset };
};
