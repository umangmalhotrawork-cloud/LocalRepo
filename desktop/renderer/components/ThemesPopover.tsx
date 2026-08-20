"use client";

import React from "react";
import { Palette, Check, X, Sparkles } from "lucide-react";
import { THEMES, ThemeDefinition } from "../theme/themeRegistry";
import { useOutsideClick } from "../hooks/useOutsideClick";

interface ThemesPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
}

export default function ThemesPopover({
  isOpen,
  onClose,
  triggerRef,
  activeThemeId = "nexus-dark",
  onSelectTheme,
}: ThemesPopoverProps) {
  const popoverRef = useOutsideClick<HTMLDivElement>({
    isOpen,
    onClose,
    triggerRef,
  });

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-11 right-12 w-84 border rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 font-mono text-xs animate-fade-in select-none"
      style={{
        backgroundColor: "var(--theme-surface-raised, #0a0a0f)",
        borderColor: "var(--theme-border-card, #1f1f2e)",
        color: "var(--theme-text, #f4f4f5)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b pb-2"
        style={{ borderColor: "var(--theme-border-subtle, #1c1c28)" }}
      >
        <div className="flex items-center gap-2 font-bold text-xs" style={{ color: "var(--theme-accent, #22d3ee)" }}>
          <Palette className="w-4 h-4" />
          <span>NEXUS Themes</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[9.5px] px-1.5 py-0.5 rounded font-bold"
            style={{
              backgroundColor: "var(--theme-accent-dim, rgba(34,211,238,0.15))",
              color: "var(--theme-accent, #22d3ee)",
            }}
          >
            8 Available
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white cursor-pointer p-0.5 rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Theme Cards List */}
      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
        {THEMES.map((theme: ThemeDefinition) => {
          const isActive = theme.id === activeThemeId;

          return (
            <button
              key={theme.id}
              onClick={() => {
                onSelectTheme(theme.id);
                onClose();
              }}
              className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? "border-cyan-500/60 bg-cyan-950/30 shadow-sm"
                  : "border-transparent hover:border-white/10 hover:bg-white/5"
              }`}
              style={{
                borderColor: isActive ? "var(--border-focus, #22d3ee)" : undefined,
                backgroundColor: isActive ? "var(--accent-primary-dim, rgba(34,211,238,0.12))" : undefined,
              }}
            >
              {/* Left: Swatches + Name + Description */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* 4-Color Swatch Preview Box */}
                <div
                  className="w-7 h-7 rounded-lg p-0.5 grid grid-cols-2 gap-0.5 shrink-0 shadow-inner border border-white/10"
                  style={{ backgroundColor: theme.colors.themeBackground }}
                  title={`${theme.name} Palette Preview`}
                >
                  {theme.colors.swatches.map((color, idx) => (
                    <div
                      key={idx}
                      className="w-full h-full rounded-[2px]"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[11.5px] truncate text-zinc-100 group-hover:text-white">
                      {theme.name}
                    </span>
                    {theme.id === "nexus-dark" && (
                      <span className="text-[8.5px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-bold">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {theme.description}
                  </div>
                </div>
              </div>

              {/* Right: Active Check Indicator */}
              <div className="shrink-0 ml-2">
                {isActive ? (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center border"
                    style={{
                      backgroundColor: "var(--accent-primary, #22d3ee)",
                      color: "#000000",
                      borderColor: "var(--accent-primary, #22d3ee)",
                    }}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-white/10 group-hover:border-white/30 transition-colors" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="pt-2 border-t flex items-center justify-between text-[10px] text-zinc-400"
        style={{ borderColor: "var(--border-subtle, #1c1c28)" }}
      >
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Global NEXUS Theme Engine</span>
        </span>
        <span className="text-[9.5px] text-zinc-500">Persistent across sessions</span>
      </div>
    </div>
  );
}
