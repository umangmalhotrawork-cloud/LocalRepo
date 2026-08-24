"use client";

import React from "react";
import SourceControlPanel, { SourceControlPanelProps } from "./SourceControlPanel";
import { useOutsideClick } from "../hooks/useOutsideClick";

export interface SourceControlPopoverProps extends SourceControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export default function SourceControlPopover({
  isOpen,
  onClose,
  triggerRef,
  ...sourceControlProps
}: SourceControlPopoverProps) {
  const popoverRef = useOutsideClick<HTMLDivElement>({
    isOpen,
    onClose,
    triggerRef,
  });

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-10.5 right-0 w-[360px] max-w-[calc(100vw-24px)] max-h-[500px] border rounded-2xl shadow-2xl z-50 flex flex-col font-mono text-xs animate-fade-in overflow-hidden backdrop-blur-xl"
      style={{
        backgroundColor: "rgba(8, 10, 18, 0.78)",
        borderColor: "rgba(34, 211, 238, 0.22)",
        color: "var(--theme-text, #f4f4f5)",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6), 0 0 16px rgba(6, 182, 212, 0.12)",
      }}
    >
      <SourceControlPanel
        {...sourceControlProps}
        isPopover={true}
        onClosePopover={onClose}
      />
    </div>
  );
}
