/**
 * StorageQuotaBar — Phase 5 C-3
 *
 * Compact storage usage bar shown in FilesPanel.
 * - Green   < 80% used
 * - Yellow  80–90% used (warn)
 * - Red     > 90% used (critical)
 * - Shows persisted storage badge
 */
import { useStorageQuota } from "../lib/quotaGuard";

export function StorageQuotaBar() {
  const estimate = useStorageQuota(30_000);

  if (!estimate) return null;

  const pct = Math.round(estimate.usedFraction * 100);
  const color =
    estimate.usedFraction >= 0.9 ? "#ef4444" :
    estimate.usedFraction >= 0.8 ? "#f59e0b" :
    "#22c55e";

  return (
    <div
      className="storage-quota-bar"
      role="region"
      aria-label={`Storage: ${estimate.usedMB} MB of ${estimate.quotaMB} MB used`}
    >
      <div className="storage-quota-labels">
        <span className="storage-quota-label">
          Storage: {estimate.usedMB} MB / {estimate.quotaMB} MB
        </span>
        {estimate.persisted && (
          <span className="storage-quota-persisted" title="Persistent storage granted">
            🔒 Persistent
          </span>
        )}
        {!estimate.persisted && (
          <span className="storage-quota-ephemeral" title="Storage may be cleared by browser">
            ⚠ Ephemeral
          </span>
        )}
      </div>
      <div className="storage-quota-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="storage-quota-fill"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: color,
          }}
        />
      </div>
      {estimate.usedFraction >= 0.8 && (
        <div className="storage-quota-warn">
          {estimate.usedFraction >= 0.9
            ? `⛔ Storage critical (${pct}%) — remove sources before adding more files.`
            : `⚠ Storage ${pct}% full — consider removing unused sources.`
          }
        </div>
      )}
    </div>
  );
}
