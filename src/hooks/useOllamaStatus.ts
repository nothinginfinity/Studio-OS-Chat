import { useEffect, useState, useCallback } from "react";
import { listOllamaModels } from "../lib/ollama";

export type OllamaConnectionState = "checking" | "connected" | "error";

export interface OllamaStatus {
  state: OllamaConnectionState;
  models: string[];
  errorMessage: string;
  lastChecked: number | null;
  recheck: () => void;
}

/** Pass null as baseUrl when Ollama is not the active provider — disables all polling. */
export function useOllamaStatus(baseUrl: string | null): OllamaStatus {
  const [state, setState] = useState<OllamaConnectionState>("checking");
  const [models, setModels] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const recheck = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    // No baseUrl — cloud provider is active, skip all network calls
    if (!baseUrl) return;

    let active = true;
    setState("checking");
    setErrorMessage("");

    listOllamaModels(baseUrl)
      .then((items) => {
        if (!active) return;
        setModels(items);
        setState("connected");
        setLastChecked(Date.now());
        setErrorMessage("");
      })
      .catch((err) => {
        if (!active) return;
        setState("error");
        setModels([]);
        setLastChecked(Date.now());
        setErrorMessage(
          err instanceof Error ? err.message : "Cannot reach Ollama"
        );
      });

    return () => { active = false; };
  }, [baseUrl, tick]);

  return { state, models, errorMessage, lastChecked, recheck };
}
