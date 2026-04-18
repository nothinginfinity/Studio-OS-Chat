import { useEffect, useState } from "react";

export function usePersistentState<T>(
  load: () => T,
  save: (value: T) => void
) {
  const [state, setState] = useState<T>(load);

  useEffect(() => {
    save(state);
  }, [state, save]);

  return [state, setState] as const;
}
