/**
 * C-2: Wraps the chat send button to disable it when offline
 * and show a tooltip explaining why.
 */
import React from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

interface OfflineSendGuardProps {
  children: (disabled: boolean) => React.ReactNode;
}

export const OfflineSendGuard: React.FC<OfflineSendGuardProps> = ({ children }) => {
  const { isOnline } = useNetworkStatus();
  return (
    <span
      title={!isOnline ? "Requires internet connection" : undefined}
      style={{ display: "inline-flex" }}
    >
      {children(!isOnline)}
    </span>
  );
};

export default OfflineSendGuard;
