/**
 * A-3: Stable hook utilities — prevent unnecessary re-renders caused by
 * unstable references from context or hook returns.
 */
import { useRef, useCallback } from "react";

/** Returns a stable callback ref that always calls the latest version of fn. */
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn);
  ref.current = fn;
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}
