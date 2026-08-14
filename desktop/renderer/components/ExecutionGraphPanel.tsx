"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Search,
  ArrowRight,
  Activity,
  AlertTriangle,
  FileCode,
  Sparkles,
  Info,
  Clock,
} from "lucide-react";
import { DebugStep } from "../../runtime/pythonTimeTravelDebugger";
import {
  buildExecutionGraph,
  extractVariableTimelines,
  ExecutionNode,
  ExecutionEdge,
  VariableTimeline,
} from "../../engine/executionGraph";

interface ExecutionGraphPanelProps {
  steps: DebugStep[];
  currentIndex: number;
  onSelectStep: (stepIndex: number) => void;
}

export default function ExecutionGraphPanel({
  steps,
  currentIndex,
  onSelectStep,
}: ExecutionGraphPanelProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<ExecutionNode | null>(null);
  const [varSearch, setVarSearch] = useState("");
  const [showMemoryFlow, setShowMemoryFlow] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Memoized Graph Construction
  const graph = useMemo(() => {
    return buildExecutionGraph(steps);
  }, [steps]);

  // 2. Memoized Variable Timelines
  const variableTimelines = useMemo(() => {
    return extractVariableTimelines(steps);
  }, [steps]);

  // Filtered variable timelines
  const filteredTimelines = useMemo(() => {
    if (!varSearch.trim()) return variableTimelines;
    const q = varSearch.toLowerCase();
    return variableTimelines.filter((t) => t.name.toLowerCase().includes(q));
  }, [variableTimelines, varSearch]);

  // 3. Compute Node Layout Coordinates (Deterministic grid layout)
  const layoutNodes = useMemo(() => {
    const coords = new Map<string, { x: number; y: number; node: ExecutionNode }>();
    const columnWidth = 140;
    const rowHeight = 70;

    graph.nodes.forEach((node, idx) => {
      let row = 1; // Default line row
      if (node.type === "function") row = 0;
      else if (node.type === "variable") row = 2;
      else if (node.type === "exception") row = 3;

      const col = node.step;
      const x = col * columnWidth + 40;
      const y = row * rowHeight + 40;

      coords.set(node.id, { x, y, node });
    });

    return coords;
  }, [graph.nodes]);

  // Pan & Zoom Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.max(0.2, Math.min(3.0, prev * zoomFactor)));
  };

  const handleFitToScreen = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  // Center on current step when changed
  useEffect(() => {
    const activeNode = Array.from(layoutNodes.values()).find((n) => n.node.step === currentIndex);
    if (activeNode && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      setPan((prev) => ({
        ...prev,
        x: -activeNode.x * zoom + containerWidth / 2 - 100,
      }));
    }
  }, [currentIndex, layoutNodes, zoom]);

  return (
    <div className="h-full flex overflow-hidden bg-[#050507] font-mono text-xs select-none">
      {/* Left: Graph Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 relative h-full overflow-hidden cursor-grab active:cursor-grabbing bg-[#050507]"
      >
        {/* Floating Canvas Controls */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-[#0d0d12]/90 backdrop-blur-md p-1 rounded-xl border border-[#27272a] shadow-lg">
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z * 1.2))}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFitToScreen}
            className="p-1.5 rounded hover:bg-zinc-800 text-cyan-400 hover:text-cyan-300"
            title="Fit to Screen / Reset View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="px-1.5 text-[10px] text-zinc-500 font-bold">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setShowMemoryFlow((prev) => !prev)}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
              showMemoryFlow
                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                : "text-zinc-400 hover:text-white"
            }`}
            title="Toggle Memory Flow Sidebar"
          >
            Memory Flow
          </button>
        </div>

        {/* SVG Graph Surface */}
        <svg className="w-full h-full">
          <defs>
            <marker
              id="arrow-next"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
            </marker>
            <marker
              id="arrow-mutates"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
            <marker
              id="arrow-calls"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Render Edges */}
            {graph.edges.map((edge, idx) => {
              const fromPos = layoutNodes.get(edge.from);
              const toPos = layoutNodes.get(edge.to);
              if (!fromPos || !toPos) return null;

              const isMutation = edge.label === "mutates";
              const isCall = edge.label === "calls" || edge.label === "returns";
              const color = isMutation ? "#10b981" : isCall ? "#8b5cf6" : "#06b6d4";
              const marker = isMutation ? "url(#arrow-mutates)" : isCall ? "url(#arrow-calls)" : "url(#arrow-next)";

              // Curved cubic bezier
              const dx = toPos.x - fromPos.x;
              const dy = toPos.y - fromPos.y;
              const cx1 = fromPos.x + dx / 2;
              const cy1 = fromPos.y;
              const cx2 = fromPos.x + dx / 2;
              const cy2 = toPos.y;

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={`M ${fromPos.x + 50} ${fromPos.y + 15} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toPos.x} ${toPos.y + 15}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                    markerEnd={marker}
                  />
                  {edge.label && (
                    <text
                      x={(fromPos.x + toPos.x) / 2 + 20}
                      y={(fromPos.y + toPos.y) / 2 + 10}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 2. Render Nodes */}
            {Array.from(layoutNodes.values()).map(({ x, y, node }) => {
              const isCurrent = node.step === currentIndex;
              const isFunc = node.type === "function";
              const isVar = node.type === "variable";
              const isExc = node.type === "exception";

              const bgFill = isCurrent
                ? "#083344"
                : isFunc
                ? "#1e1b4b"
                : isVar
                ? "#064e3b"
                : isExc
                ? "#4c0519"
                : "#18181b";

              const strokeColor = isCurrent
                ? "#22d3ee"
                : isFunc
                ? "#818cf8"
                : isVar
                ? "#34d399"
                : isExc
                ? "#f43f5e"
                : "#27272a";

              return (
                <g
                  key={node.id}
                  transform={`translate(${x}, ${y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStep(node.step);
                  }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer group"
                >
                  {/* Outer Glow on Current */}
                  {isCurrent && (
                    <rect
                      x="-4"
                      y="-4"
                      width="118"
                      height="38"
                      rx="10"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2"
                      className="animate-pulse"
                    />
                  )}

                  {/* Node Body */}
                  <rect
                    width="110"
                    height="30"
                    rx="8"
                    fill={bgFill}
                    stroke={strokeColor}
                    strokeWidth={isCurrent ? "2" : "1"}
                    className="transition-colors group-hover:brightness-125 shadow-md"
                  />

                  {/* Node Text Label */}
                  <text
                    x="10"
                    y="19"
                    fill={isCurrent ? "#ecfeff" : "#d4d4d8"}
                    fontSize="10"
                    fontWeight={isCurrent ? "bold" : "normal"}
                    fontFamily="monospace"
                  >
                    {node.label.length > 15 ? `${node.label.slice(0, 14)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredNode && (
          <div className="absolute bottom-3 left-3 bg-[#0d0d12]/95 backdrop-blur-md p-2.5 rounded-xl border border-cyan-500/40 text-[11px] shadow-2xl z-20 space-y-1 pointer-events-none animate-fadeIn">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Step {hoveredNode.step + 1} ({hoveredNode.type.toUpperCase()})</span>
            </div>
            <div className="text-zinc-300">{hoveredNode.label}</div>
            {hoveredNode.details && (
              <div className="text-zinc-500 text-[10px]">
                {JSON.stringify(hoveredNode.details)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Memory Flow (Variable Mutation Inspector) */}
      {showMemoryFlow && (
        <div className="w-72 border-l border-[#1f1f1f] bg-[#09090c] flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="h-8 bg-[#0d0d12] border-b border-[#1f1f1f] px-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10.5px]">
              <Layers className="w-3.5 h-3.5" />
              <span>MEMORY FLOW TIMELINE</span>
            </div>
            <span className="text-[10px] text-zinc-500">{filteredTimelines.length} variables</span>
          </div>

          {/* Search Box */}
          <div className="p-2 border-b border-[#1f1f1f] bg-[#070709]">
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2" />
              <input
                type="text"
                value={varSearch}
                onChange={(e) => setVarSearch(e.target.value)}
                placeholder="Filter variables..."
                className="w-full bg-[#121216] border border-[#27272a] focus:border-cyan-500/60 rounded px-2 py-1 pl-7 text-zinc-100 placeholder:text-zinc-600 outline-none text-[10.5px] font-mono"
              />
            </div>
          </div>

          {/* Timelines List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {filteredTimelines.map((timeline) => (
              <div
                key={timeline.name}
                className="p-2 rounded-xl bg-[#0e0e14] border border-[#1f1f26] space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                  <span>{timeline.name}</span>
                  <span className="text-[9.5px] text-zinc-500 font-normal">
                    {timeline.history.length} snapshots
                  </span>
                </div>

                {/* History Snapshots Horizontal Ribbon */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {timeline.history.map((entry, idx) => {
                    const isSelected = entry.step === currentIndex;
                    return (
                      <div
                        key={idx}
                        onClick={() => onSelectStep(entry.step)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer shrink-0 transition-all font-mono text-[9.5px] ${
                          isSelected
                            ? "bg-cyan-950 text-cyan-300 border border-cyan-400 font-bold"
                            : entry.changed
                            ? "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/30"
                            : "bg-[#18181f] text-zinc-400 hover:text-white"
                        }`}
                        title={`Step ${entry.step + 1} (L${entry.line}): ${JSON.stringify(entry.value)}`}
                      >
                        {JSON.stringify(entry.value).slice(0, 8)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredTimelines.length === 0 && (
              <div className="py-8 text-center text-zinc-600 text-xs">
                No variables matching filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
