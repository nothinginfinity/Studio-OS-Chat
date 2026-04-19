/**
 * ProviderSettings.tsx
 * InfinityPaste-style collapsible provider cards.
 * One card per provider: icon, name, models, key input, save/remove.
 * Active provider is highlighted. Keys stored via providers.ts helpers.
 */
import { useState, useEffect } from "react";
import {
  PROVIDERS,
  loadApiKey,
  saveApiKey,
  deleteApiKey
} from "../lib/providers";
import type { ChatSettings } from "../lib/types";

interface Props {
  settings: ChatSettings;
  onSettingsChange: (s: ChatSettings) => void;
}

export default function ProviderSettings({ settings, onSettingsChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>({});

  // Load all saved keys on mount
  useEffect(() => {
    const keys: Record<string, string> = {};
    for (const p of PROVIDERS) {
      keys[p.id] = loadApiKey(p.id);
    }
    setSavedKeys(keys);
    setKeyInputs(keys);
  }, []);

  function toggleCard(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  function handleSave(providerId: string) {
    const key = keyInputs[providerId] ?? "";
    saveApiKey(providerId, key);
    setSavedKeys((prev) => ({ ...prev, [providerId]: key }));
    // If saving key for active provider, update settings too
    if (settings.provider === providerId) {
      onSettingsChange({ ...settings, apiKey: key });
    }
  }

  function handleDelete(providerId: string) {
    deleteApiKey(providerId);
    setKeyInputs((prev) => ({ ...prev, [providerId]: "" }));
    setSavedKeys((prev) => ({ ...prev, [providerId]: "" }));
    if (settings.provider === providerId) {
      onSettingsChange({ ...settings, apiKey: "" });
    }
  }

  function handleSelectProvider(providerId: string) {
    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;
    onSettingsChange({
      ...settings,
      provider: providerId,
      model: provider.defaultModel,
      apiKey: loadApiKey(providerId)
    });
  }

  return (
    <div className="provider-settings">
      <div className="settings-section-title">AI Provider</div>
      <p className="provider-settings-note">
        🔒 Keys stored only on this device and sent directly to each provider.
      </p>

      {PROVIDERS.map((provider) => {
        const isActive = settings.provider === provider.id;
        const isOpen = openId === provider.id;
        const hasKey = !!savedKeys[provider.id];
        const isOllama = provider.id === "ollama";

        return (
          <div
            key={provider.id}
            className={`provider-card${isActive ? " provider-card--active" : ""}`}
          >
            {/* Card Header */}
            <div
              className="provider-card-header"
              onClick={() => toggleCard(provider.id)}
            >
              <div className="provider-card-left">
                <span className="provider-icon">{provider.icon}</span>
                <div>
                  <div className="provider-name">{provider.name}</div>
                  <div className="provider-models">
                    {isOllama ? "Local — no key needed" : provider.models.slice(0, 3).join(" · ")}
                  </div>
                </div>
              </div>
              <div className="provider-card-right">
                {isOllama ? null : (
                  <span
                    className={`provider-key-dot${hasKey ? " provider-key-dot--set" : ""}`}
                    title={hasKey ? "Key saved" : "No key"}
                  />
                )}
                {isActive && <span className="provider-badge">Active</span>}
                <span className="provider-chevron">{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Card Body */}
            {isOpen && (
              <div className="provider-card-body">
                {!isOllama && (
                  <>
                    <input
                      type="password"
                      className="provider-key-input"
                      placeholder={provider.keyPlaceholder}
                      autoComplete="off"
                      value={keyInputs[provider.id] ?? ""}
                      onChange={(e) =>
                        setKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                      }
                    />
                    <div className="provider-key-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSave(provider.id)}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(provider.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}

                {/* Model selector */}
                {provider.models.length > 0 && (
                  <div className="provider-model-row">
                    <label className="provider-model-label">Model</label>
                    <select
                      className="provider-model-select"
                      value={isActive ? settings.model : provider.defaultModel}
                      onChange={(e) => {
                        if (isActive) {
                          onSettingsChange({ ...settings, model: e.target.value });
                        }
                      }}
                      disabled={!isActive}
                    >
                      {provider.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Set as active button */}
                {!isActive && (
                  <button
                    className="btn btn-accent btn-sm provider-activate-btn"
                    onClick={() => handleSelectProvider(provider.id)}
                  >
                    ✓ Use {provider.name}
                  </button>
                )}

                {isActive && (
                  <div className="provider-active-note">✓ Currently active</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
