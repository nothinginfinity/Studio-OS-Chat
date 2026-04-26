/**
 * C-2: Offline banner component.
 * Renders at the top of the app shell when navigator.onLine === false.
 * Disappears within 200 ms of reconnection via useNetworkStatus().
 */
import React from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;
  return (
    <div
      data-testid="offline-banner"
      role="status"
      aria-live="polite"
      className="offline-banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        background: "#F59E0B",
        color: "#1C1917",
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.3,
      }}
    >
      <span aria-hidden="true">⚡</span>
      You&apos;re offline — file search and viewing still work
    </div>
  );
};

export default OfflineBanner;
