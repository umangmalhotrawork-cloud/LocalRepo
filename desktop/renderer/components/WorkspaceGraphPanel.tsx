"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Network, ZoomIn, ZoomOut, RotateCcw, Filter, FileText, 
  Sparkles, AlertTriangle, ShieldCheck, ArrowRight, Activity, X, Layers, Search
} from "lucide-react";

export interface GraphNode {
  id: string;
  file: string;
  symbol: string;
  line: number;
  kind: "definition" | "ghost_operation" | "use" | "return_sink" | string;
  code?: string;
  label: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface WorkspaceGraph {
  workspace: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  error?: string;
}

interface WorkspaceGraphPanelProps {
  graph: WorkspaceGraph | null;
  loading: boolean;
  onRefresh: () => void;
  onNodeClick: (node: GraphNode) => void;
  onClose?: () => void;
}

export default function WorkspaceGraphPanel({
  graph,
  loading,
  onRefresh,
  onNodeClick,
  onClose,
}: WorkspaceGraphPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string>("ALL");
  const [selectedKind, setSelectedKind] = useState<string>("ALL");
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pan and Zoom transform state
  const [transform, setTransform] = useState({ x: 60, y: 80, scale: 1.0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const files = useMemo(() => {
    if (!graph || !graph.nodes) return [];
    return Array.from(new Set(graph.nodes.map((n) => n.file)));
  }, [graph]);

  // Filter nodes & edges
  const filteredNodes = useMemo(() => {
    if (!graph || !graph.nodes) return [];
    return graph.nodes.filter((n) => {
      if (selectedFile !== "ALL" && n.file !== selectedFile) return false;
      if (selectedKind !== "ALL" && n.kind !== selectedKind) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = n.label.toLowerCase().includes(q);
        const matchesCode = (n.code || "").toLowerCase().includes(q);
        const matchesFile = n.file.toLowerCase().includes(q);
        if (!matchesLabel && !matchesCode && !matchesFile) return false;
      }
      return true;
    });
  }, [graph, selectedFile, selectedKind, searchQuery]);

  const filteredNodeIds = useMemo(() => {
    return new Set(filteredNodes.map((n) => n.id));
  }, [filteredNodes]);

  const filteredEdges = useMemo(() => {
    if (!graph || !graph.edges) return [];
    return graph.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );
  }, [graph, filteredNodeIds]);

  // Compute 2D node coordinates grouped by file in vertical lanes
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const fileGroups: Record<string, GraphNode[]> = {};

    filteredNodes.forEach((node) => {
      if (!fileGroups[node.file]) fileGroups[node.file] = [];
      fileGroups[node.file].push(node);
    });

    const fileList = Object.keys(fileGroups);
    const laneWidth = 320;
    const nodeHeight = 54;
    const verticalGap = 24;

    fileList.forEach((file, fileIdx) => {
      const startX = fileIdx * laneWidth + 40;
      const nodesInFile = fileGroups[file];

      // Sort: definition -> ghost_operation -> use -> return_sink
      const kindOrder: Record<string, number> = {
        definition: 1,
        ghost_operation: 2,
        use: 3,
        return_sink: 4,
      };

      nodesInFile.sort((a, b) => {
        const orderA = kindOrder[a.kind] || 5;
        const orderB = kindOrder[b.kind] || 5;
        if (orderA !== orderB) return orderA - orderB;
        return a.line - b.line;
      });

      nodesInFile.forEach((node, nodeIdx) => {
        const y = nodeIdx * (nodeHeight + verticalGap) + 60;
        positions[node.id] = {
          x: startX,
          y: y,
          width: 240,
          height: nodeHeight,
        };
      });
    });

    return positions;
  }, [filteredNodes]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== svgRef.current && (e.target as HTMLElement).tagName !== "svg") return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    }));
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(2.5, prev.scale * zoomFactor)),
    }));
  };

  const resetView = () => setTransform({ x: 60, y: 80, scale: 1.0 });

  const getNodeColors = (kind: string) => {
    switch (kind) {
      case "definition":
        return {
          bg: "fill-[#042f2e]",
          border: "stroke-cyan-400",
          text: "text-cyan-300",
          badgeBg: "bg-cyan-950 text-cyan-300 border-cyan-500/40",
          edgeStroke: "#22d3ee",
        };
      case "ghost_operation":
        return {
          bg: "fill-[#451a03]",
          border: "stroke-amber-400",
          text: "text-amber-300",
          badgeBg: "bg-amber-950 text-amber-300 border-amber-500/40",
          edgeStroke: "#f59e0b",
        };
      case "use":
        return {
          bg: "fill-[#2e1065]",
          border: "stroke-purple-400",
          text: "text-purple-300",
          badgeBg: "bg-purple-950 text-purple-300 border-purple-500/40",
          edgeStroke: "#a855f7",
        };
      case "return_sink":
        return {
          bg: "fill-[#064e3b]",
          border: "stroke-emerald-400",
          text: "text-emerald-300",
          badgeBg: "bg-emerald-950 text-emerald-300 border-emerald-500/40",
          edgeStroke: "#10b981",
        };
      case "clone":
        return {
          bg: "fill-[#3b0764]",
          border: "stroke-purple-400",
          text: "text-purple-300",
          badgeBg: "bg-purple-950 text-purple-300 border-purple-500/40",
          edgeStroke: "#a855f7",
        };
      case "semantic_clone":
        return {
          bg: "fill-[#083344]",
          border: "stroke-cyan-400",
          text: "text-cyan-300",
          badgeBg: "bg-cyan-950 text-cyan-300 border-cyan-500/40",
          edgeStroke: "#06b6d4",
        };
      default:
        return {
          bg: "fill-[#18181b]",
          border: "stroke-zinc-500",
          text: "text-zinc-300",
          badgeBg: "bg-zinc-900 text-zinc-300 border-zinc-700",
          edgeStroke: "#71717a",
        };
    }
  };

  const cloneCount = useMemo(() => {
    return filteredNodes.filter((n) => n.kind === "clone").length;
  }, [filteredNodes]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] text-zinc-100 font-mono select-none overflow-hidden relative">
      
      {/* 1. Header Toolbar */}
      <div className="p-3 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400" />
            <h2 className="font-heading font-bold text-sm text-white">
              Cross-File Provenance Graph
            </h2>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141414] rounded-xl border border-[#262626] text-xs text-zinc-400">
            <span>{filteredNodes.length} nodes</span>
            <span>•</span>
            <span>{filteredEdges.length} edges</span>
            {cloneCount > 0 && (
              <>
                <span>•</span>
                <span className="text-purple-400 font-bold">{cloneCount} clones</span>
              </>
            )}
          </div>
        </div>

        {/* Filters and Search Controls */}
        <div className="flex items-center gap-2">
          
          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#121212] border border-[#262626] text-xs">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search symbol / code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-zinc-200 text-xs w-36 placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* File Filter Dropdown */}
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="px-2.5 py-1 rounded-xl bg-[#121212] border border-[#262626] text-xs text-zinc-300 outline-none hover:border-cyan-500/40 transition-colors"
          >
            <option value="ALL">All Files ({files.length})</option>
            {files.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Kind Filter Buttons */}
          <div className="flex items-center gap-1 p-0.5 bg-[#121212] rounded-xl border border-[#262626] text-[11px]">
            {[
              { id: "ALL", label: "All" },
              { id: "definition", label: "Defs", color: "text-cyan-400" },
              { id: "ghost_operation", label: "Ghosts", color: "text-amber-400" },
              { id: "use", label: "Uses", color: "text-purple-400" },
              { id: "return_sink", label: "Sinks", color: "text-emerald-400" },
              { id: "clone", label: "Clones", color: "text-pink-400" },
              { id: "semantic_clone", label: "Semantic", color: "text-cyan-400" },
            ].map((k) => (
              <button
                key={k.id}
                onClick={() => setSelectedKind(k.id)}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  selectedKind === k.id
                    ? "bg-[#202020] text-white font-bold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                } ${k.color || ""}`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* Zoom & Rescan Tools */}
          <div className="flex items-center gap-1 border-l border-[#262626] pl-2">
            <button
              onClick={() => setTransform((p) => ({ ...p, scale: Math.min(2.5, p.scale * 1.15) }))}
              className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#202020] text-zinc-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransform((p) => ({ ...p, scale: Math.max(0.3, p.scale * 0.85) }))}
              className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#202020] text-zinc-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#202020] text-zinc-400 hover:text-white"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-1 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-cyan-glow"
            >
              {loading ? (
                <Activity className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Network className="w-3.5 h-3.5" />
              )}
              <span>Re-graph</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-[#262626] text-zinc-400 hover:text-white hover:bg-zinc-900"
                title="Close Graph"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 2. Interactive SVG Canvas */}
      <div 
        className="flex-1 w-full h-full relative overflow-hidden bg-[#050505] cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
        >
          <defs>
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
            </marker>
            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
            </marker>
            <marker
              id="arrow-purple"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
            </marker>
            <marker
              id="arrow-emerald"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
            </marker>
            <marker
              id="arrow-magenta"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" />
            </marker>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#52525b" />
            </marker>

            {/* Background grid pattern */}
            <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#141414" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#graph-grid)" />

          {/* Transform Container */}
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            
            {/* Edges */}
            {filteredEdges.map((edge, idx) => {
              const srcPos = nodePositions[edge.source];
              const tgtPos = nodePositions[edge.target];
              if (!srcPos || !tgtPos) return null;

              const isCloneEdge = edge.type === "clone" || edge.type === "structural-clone";
              const isSemanticClone = edge.type === "semantic_clone";
              const isGhostEdge = edge.type === "ghost_flow";
              const isCrossFile = edge.type === "cross_file_import";

              const x1 = srcPos.x + srcPos.width;
              const y1 = srcPos.y + srcPos.height / 2;
              const x2 = tgtPos.x;
              const y2 = tgtPos.y + tgtPos.height / 2;

              const dx = Math.abs(x2 - x1) * 0.5;
              const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              const markerColor = isSemanticClone
                ? "url(#arrow-cyan)"
                : isCloneEdge
                ? "url(#arrow-purple)"
                : isGhostEdge
                ? "url(#arrow-amber)"
                : isCrossFile
                ? "url(#arrow-purple)"
                : "url(#arrow-cyan)";

              const strokeColor = isSemanticClone
                ? "#06b6d4"
                : isCloneEdge
                ? "#a855f7"
                : isGhostEdge
                ? "#f59e0b"
                : isCrossFile
                ? "#8b5cf6"
                : "#0891b2";

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSemanticClone || isCloneEdge ? "2.2" : isGhostEdge ? "2.5" : "1.8"}
                    strokeDasharray={isSemanticClone || isCloneEdge ? "4,4" : isCrossFile ? "5,5" : undefined}
                    strokeOpacity={isSemanticClone ? 0.9 : isCloneEdge ? 0.85 : 0.65}
                    markerEnd={markerColor}
                    className="hover:stroke-white transition-colors"
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const colors = getNodeColors(node.kind);
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNode?.id === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    onNodeClick(node);
                  }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer group"
                >
                  {/* Node Background Rectangle */}
                  <rect
                    width={pos.width}
                    height={pos.height}
                    rx="10"
                    className={`${colors.bg} ${colors.border} transition-all`}
                    strokeWidth={isSelected || isHovered ? "2" : "1"}
                    strokeOpacity={isSelected ? 1.0 : 0.6}
                    fillOpacity={0.85}
                  />

                  {/* Header: Kind Badge & Line */}
                  <g transform="translate(10, 16)">
                    <text
                      className={`text-[9px] font-bold uppercase ${colors.text}`}
                      fill="currentColor"
                    >
                      {node.kind.replace("_", " ")}
                    </text>
                    <text
                      x={pos.width - 24}
                      className="text-[9px] text-zinc-400 font-bold"
                      fill="#a1a1aa"
                      textAnchor="end"
                    >
                      L{node.line}
                    </text>
                  </g>

                  {/* Label / Symbol */}
                  <g transform="translate(10, 36)">
                    <text
                      className="text-[11px] font-bold text-white group-hover:text-cyan-300"
                      fill="#ffffff"
                    >
                      {node.label.length > 28 ? node.label.substring(0, 25) + "..." : node.label}
                    </text>
                  </g>

                  {/* Node file tag */}
                  <g transform="translate(10, 48)">
                    <text
                      className="text-[8px] text-zinc-500 truncate"
                      fill="#71717a"
                    >
                      {node.file.split("/").pop()}
                    </text>
                  </g>
                </g>
              );
            })}

          </g>
        </svg>

        {/* 3. Floating Hover Tooltip */}
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 p-4 bg-[#0d0d0d] border border-cyan-500/40 rounded-xl shadow-2xl z-20 max-w-md pointer-events-none font-mono space-y-2 animate-fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-[#222] pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-bold text-xs text-white">{hoveredNode.symbol}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getNodeColors(hoveredNode.kind).badgeBg}`}>
                {hoveredNode.kind.replace("_", " ")}
              </span>
            </div>

            <div className="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>{hoveredNode.file}:{hoveredNode.line}</span>
              <span className="text-[10px] text-cyan-400">Click node to inspect line</span>
            </div>

            {hoveredNode.code && (
              <div className="p-2 bg-[#050505] rounded border border-zinc-800 text-[11px] text-zinc-200 overflow-x-auto">
                <code>{hoveredNode.code}</code>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
