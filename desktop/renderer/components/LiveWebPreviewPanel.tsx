"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, ExternalLink, Globe, X } from "lucide-react";
import { buildPreviewHtml } from "../../engine/live_web_preview";

interface TabItem {
  path: string;
  name: string;
  content: string;
}

interface LiveWebPreviewPanelProps {
  activeTab: TabItem | null;
  openTabs: TabItem[];
  onClose?: () => void;
}

export default function LiveWebPreviewPanel({
  activeTab,
  openTabs,
  onClose,
}: LiveWebPreviewPanelProps) {
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Debounced preview update within 300ms of editor changes
  useEffect(() => {
    const timer = setTimeout(() => {
      let html = "";
      let css = "";
      let js = "";

      if (activeTab) {
        if (activeTab.path.endsWith(".html") || activeTab.path.endsWith(".htm")) {
          html = activeTab.content;
        } else if (activeTab.path.endsWith(".css")) {
          css = activeTab.content;
        } else if (activeTab.path.endsWith(".js") || activeTab.path.endsWith(".jsx") || activeTab.path.endsWith(".ts") || activeTab.path.endsWith(".tsx")) {
          js = activeTab.content;
        }
      }

      const generated = buildPreviewHtml({
        htmlContent: html,
        cssContent: css,
        jsContent: js,
        openTabs,
      });

      setPreviewHtml(generated);
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab?.content, activeTab?.path, openTabs, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpenNewWindow = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b] border-l border-[#1f1f1f] select-none">
      {/* Header Toolbar */}
      <div className="px-3 py-2 bg-[#0d0d10] border-b border-[#1f1f1f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold text-zinc-200">
            LIVE WEB PREVIEW
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Auto-updating preview active (300ms latency)" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 text-xs font-mono font-medium flex items-center gap-1 border border-[#27272a] transition-all cursor-pointer"
            title="Refresh Preview"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenNewWindow}
            className="p-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-xs font-mono font-medium flex items-center gap-1 border border-cyan-500/30 transition-all cursor-pointer"
            title="Open Preview in New Window"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Open New Window</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-[#1f1f1f] transition-all"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sandboxed Frame Container */}
      <div className="flex-1 bg-white relative">
        <iframe
          ref={iframeRef}
          srcDoc={previewHtml}
          sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
          className="w-full h-full border-0 bg-white"
          title="Echo Nullity Live Preview"
        />
      </div>
    </div>
  );
}
