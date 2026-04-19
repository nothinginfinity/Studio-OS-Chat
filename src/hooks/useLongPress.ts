import { useCallback, useRef, useState } from "react";

export interface UseLongPressOptions {
  delay?: number;
  moveThreshold?: number;
  onLongPress: () => void;
  onPressStart?: () => void;
  onPressCancel?: () => void;
  onPressEnd?: () => void;
}

export interface UseLongPressResult {
  isPressed: boolean;
  longPressTriggeredRef: React.MutableRefObject<boolean>;
  bind: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  };
}

export function useLongPress({
  delay = 420,
  moveThreshold = 10,
  onLongPress,
  onPressStart,
  onPressCancel,
  onPressEnd,
}: UseLongPressOptions): UseLongPressResult {
  const [isPressed, setIsPressed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clear = useCallback(
    (cancelled: boolean) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsPressed(false);
      startRef.current = null;
      if (cancelled) onPressCancel?.();
      onPressEnd?.();
    },
    [onPressCancel, onPressEnd]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Defer reset so any onClick from the PREVIOUS interaction can still read true
      setTimeout(() => { longPressTriggeredRef.current = false; }, 0);
      startRef.current = { x: e.clientX, y: e.clientY };
      setIsPressed(true);
      onPressStart?.();

      timerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        setIsPressed(false);
        timerRef.current = null;
        onLongPress();
      }, delay);
    },
    [delay, onLongPress, onPressStart]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!startRef.current || timerRef.current === null) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > moveThreshold) {
        clear(true);
      }
    },
    [moveThreshold, clear]
  );

  const onPointerUp = useCallback(() => {
    // Only treat as cancelled if the long press did NOT fire
    clear(!longPressTriggeredRef.current);
  }, [clear]);

  const onPointerCancel = useCallback(() => {
    clear(true);
  }, [clear]);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  return {
    isPressed,
    longPressTriggeredRef,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onContextMenu,
    },
  };
}
