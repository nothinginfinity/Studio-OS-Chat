import { useEffect, useState } from "react";
import { listOllamaModels } from "../lib/ollama";
import type { ChatSettings } from "../lib/types";

interface Props {
  settings: ChatSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
}

export function ModelSelector({ settings, setSettings }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listOllamaModels(settings.ollamaBaseUrl)
      .then((items) => { if (!active) return; setModels(items); setError(""); })
      .catch((err) => { if (!active) return; setError(err instanceof Error ? err.message : "Failed to load models"); });
    return () => { active = false; };
  }, [settings.ollamaBaseUrl]);

  return (
    <label className="field">
      <span>Model</span>
      {models.length > 0 ? (
        <select value={settings.model} onChange={(e) => setSettings((prev) => ({ ...prev, model: e.target.value }))}>
          {models.map((model) => (<option key={model} value={model}>{model}</option>))}
        </select>
      ) : (
        <input value={settings.model} onChange={(e) => setSettings((prev) => ({ ...prev, model: e.target.value }))} placeholder="Enter model name" />
      )}
      {error ? <small className="error">{error}</small> : null}
    </label>
  );
}
