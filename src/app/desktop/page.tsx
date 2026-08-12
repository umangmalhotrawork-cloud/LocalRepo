"use client";

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import IDEApp from "@desktop/renderer/IDEApp";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class IDEErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[DESKTOP-ERROR-BOUNDARY] Caught IDE runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans p-6">
          <div className="max-w-md w-full bg-[#0a0a0a] border border-red-500/40 rounded-2xl p-6 space-y-4 font-mono shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-red-400">Desktop IDE Render Error</h2>
              <p className="text-xs text-zinc-400 mt-1">
                {this.state.error?.message || "An unexpected error occurred while mounting the IDE."}
              </p>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-cyan-glow transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Desktop IDE</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function DesktopPage() {
  console.log('[DESKTOP-PAGE] function render');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log('[DESKTOP-PAGE] useEffect fired');
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-screen h-screen bg-[#050505] text-cyan-400 flex flex-col items-center justify-center font-mono text-sm gap-3">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-bold text-white">Loading Echo Nullity Desktop IDE...</span>
        </div>
      </div>
    );
  }

  console.log('[DESKTOP-PAGE] rendering IDEApp');
  return (
    <IDEErrorBoundary>
      <IDEApp />
    </IDEErrorBoundary>
  );
}
