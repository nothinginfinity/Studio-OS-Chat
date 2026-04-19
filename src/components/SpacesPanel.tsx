/**
 * SpacesPanel.tsx
 *
 * Spaces orchestration panel.
 * - Lists all SpaceRecords stored via spaceRecord.ts
 * - Create a new Space (name + URL)
 * - Delete a Space record
 * - Send an outbound message via sendToStudioOS() → appends to mailbox
 * - Open the Space URL in a new tab
 */
import { useState, useEffect } from "react";
import {
  listSpaces,
  createSpace,
  putSpace,
  deleteSpace,
  sendToStudioOS,
} from "../lib/spaceRecord";
import type { SpaceRecord } from "../lib/types";

export function SpacesPanel() {
  const [spaces, setSpaces] = useState<SpaceRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [msgDraft, setMsgDraft] = useState<Record<string, string>>({});
  const [sendStatus, setSendStatus] = useState<Record<string, string>>({});

  async function reload() {
    const all = await listSpaces();
    setSpaces(all);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate() {
    if (!newName.trim() || !newUrl.trim()) return;
    const space = createSpace({
      name: newName.trim(),
      spaceUrl: newUrl.trim(),
    });
    await putSpace(space);
    setNewName("");
    setNewUrl("");
    setCreating(false);
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this Space record?")) return;
    await deleteSpace(id);
    reload();
  }

  async function handleSend(space: SpaceRecord) {
    const body = msgDraft[space.id];
    if (!body?.trim()) return;
    setSendStatus((prev) => ({ ...prev, [space.id]: "Sending…" }));
    try {
      await sendToStudioOS(space, body.trim());
      setMsgDraft((prev) => ({ ...prev, [space.id]: "" }));
      setSendStatus((prev) => ({ ...prev, [space.id]: "Sent ✓" }));
    } catch (e) {
      setSendStatus((prev) => ({
        ...prev,
        [space.id]: e instanceof Error ? e.message : "Failed",
      }));
    } finally {
      setTimeout(
        () => setSendStatus((prev) => ({ ...prev, [space.id]: "" })),
        4000
      );
    }
  }

  return (
    <div className="spaces-panel">
      {/* Header */}
      <div className="spaces-panel-header">
        <div className="settings-section-title">Spaces</div>
        <button
          className="spaces-add-btn"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Cancel" : "+ New Space"}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="spaces-create-form">
          <label className="field">
            <span>Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. studio-os"
            />
          </label>
          <label className="field">
            <span>Space URL</span>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://www.perplexity.ai/spaces/…"
            />
          </label>
          <button
            className="spaces-save-btn"
            onClick={handleCreate}
            disabled={!newName.trim() || !newUrl.trim()}
          >
            Save Space
          </button>
        </div>
      )}

      {/* Empty state */}
      {spaces.length === 0 && !creating && (
        <p className="spaces-empty">No spaces yet. Add one above.</p>
      )}

      {/* Spaces list */}
      <ul className="spaces-list">
        {spaces.map((space) => (
          <li key={space.id} className="space-card">
            {/* Card header: name + URL + delete */}
            <div className="space-card-header">
              <div className="space-card-meta">
                <span className="space-card-name">{space.name}</span>
                <a
                  href={space.spaceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="space-card-url"
                >
                  {space.spaceUrl}
                </a>
              </div>
              <button
                className="space-delete-btn"
                onClick={() => handleDelete(space.id)}
                aria-label={`Remove ${space.name}`}
              >
                ✕
              </button>
            </div>

            {/* Outbound message composer */}
            <div className="space-msg-row">
              <textarea
                className="space-msg-input"
                rows={2}
                placeholder="Send message to outbound mailbox…"
                value={msgDraft[space.id] ?? ""}
                onChange={(e) =>
                  setMsgDraft((prev) => ({
                    ...prev,
                    [space.id]: e.target.value,
                  }))
                }
              />
              <button
                className="space-send-btn"
                onClick={() => handleSend(space)}
                disabled={!msgDraft[space.id]?.trim()}
              >
                Send
              </button>
            </div>

            {/* Send feedback */}
            {sendStatus[space.id] && (
              <p className="space-send-status">{sendStatus[space.id]}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
