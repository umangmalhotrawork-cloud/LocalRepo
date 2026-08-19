"use client";

import { useEffect, useRef } from "react";

export interface UseOutsideClickOptions {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  ignoreRefs?: (React.RefObject<HTMLElement | null> | null | undefined)[];
  enabled?: boolean;
  closeOnEscape?: boolean;
}

/**
 * Universal React hook to dismiss popups, popovers, dropdowns, and overlays
 * when the user clicks anywhere outside of the container and trigger.
 *
 * Requirements handled:
 * - Clicking blank workspace/background = close active popup.
 * - Clicking another popup trigger = switch/toggle correctly.
 * - Clicking inside the popup = keep it open.
 * - Clicking its trigger again = close it (handled by excluding trigger from outside-click so its native toggle fires cleanly).
 * - Preserves event propagation so clicks on buttons, inputs, editor, sidebar, composer, and navigation work normally.
 */
export function useOutsideClick<T extends HTMLElement = HTMLElement>({
  isOpen,
  onClose,
  triggerRef,
  ignoreRefs = [],
  enabled = true,
  closeOnEscape = true,
}: UseOutsideClickOptions): React.RefObject<T | null> {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!isOpen || !enabled) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      // 1. If click is inside the popup container, keep it open
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      // 2. If click is inside the trigger button/element, let the trigger's own onClick handle the toggle
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }

      // 3. If click is inside any explicitly ignored refs, keep it open
      for (const ref of ignoreRefs) {
        if (ref?.current && ref.current.contains(target)) {
          return;
        }
      }

      // 4. Click is outside: dismiss the popup immediately
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        onClose();
      }
    };

    // Use capture phase so we capture the event before DOM mutations
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    if (closeOnEscape) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
      if (closeOnEscape) {
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [isOpen, onClose, triggerRef, ignoreRefs, enabled, closeOnEscape]);

  return containerRef;
}

export default useOutsideClick;
