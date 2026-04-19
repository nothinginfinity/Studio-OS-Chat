import { useOllamaStatus } from "../hooks/useOllamaStatus";
import type { ChatSettings } from "../lib/types";

interface Props {
  settings: ChatSettings;
}

export function OllamaStatus({ settings }: Props) {
  const { state, models, errorMessage, lastChecked, recheck } =
    useOllamaStatus(settings.ollamaBaseUrl);

  const dot =
    state === "connected" ? "🟢" : state === "error" ? "🔴" : "🟡";

  const label =
    state === "connected"
      ? `${models.length} model${models.length !== 1 ? "s" : ""} available`
      : state === "error"
      ? "Ollama unreachable"
      : "Checking…";

  const time = lastChecked
    ? new Date(lastChecked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="ollama-status">
      <div className="ollama-status-row">
        <span className="ollama-status-dot">{dot}</span>
        <span className="ollama-status-label">{label}</span>
        <button className="ollama-status-recheck" onClick={recheck} title="Re-check connection">
          ↺
        </button>
      </div>
      {state === "error" && (
        <div className="ollama-status-error">{errorMessage}</div>
      )}
      {state === "connected" && models.length > 0 && (
        <div className="ollama-status-models">
          {models.map((m) => (
            <span
              key={m}
              className={`ollama-model-chip${
                m === settings.model ? " active" : ""
              }`}
            >
              {m}
            </span>
          ))}
        </div>
      )}
      {time && (
        <div className="ollama-status-time">checked {time}</div>
      )}
    </div>
  );
}
