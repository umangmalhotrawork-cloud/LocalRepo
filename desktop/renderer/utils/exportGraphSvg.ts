import { WorkspaceGraph, GraphNode } from "../components/WorkspaceGraphPanel";

export function exportGraphSvg(graph: WorkspaceGraph | null): string {
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return `<svg width="800" height="200" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" style="background:#050505;font-family:monospace;">
      <text x="400" y="100" fill="#71717a" text-anchor="middle" font-size="14">No graph data available for export.</text>
    </svg>`;
  }

  // Calculate coordinates by file lane
  const fileGroups: Record<string, GraphNode[]> = {};
  graph.nodes.forEach((node) => {
    if (!fileGroups[node.file]) fileGroups[node.file] = [];
    fileGroups[node.file].push(node);
  });

  const fileList = Object.keys(fileGroups);
  const laneWidth = 280;
  const nodeRadius = 14;
  const verticalGap = 40;
  const paddingX = 60;
  const paddingY = 60;

  const positions: Record<string, { x: number; y: number; node: GraphNode }> = {};
  let maxY = 400;

  fileList.forEach((file, fileIdx) => {
    const startX = fileIdx * laneWidth + paddingX;
    const nodesInFile = fileGroups[file];

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
      const y = nodeIdx * (nodeRadius * 2 + verticalGap) + paddingY;
      positions[node.id] = { x: startX, y, node };
      if (y + 100 > maxY) maxY = y + 100;
    });
  });

  const totalWidth = Math.max(900, fileList.length * laneWidth + paddingX * 2);
  const totalHeight = Math.max(500, maxY);

  const getNodeColor = (kind: string) => {
    switch (kind) {
      case "definition":
        return { fill: "#042f2e", stroke: "#22d3ee", text: "#67e8f9" };
      case "ghost_operation":
        return { fill: "#451a03", stroke: "#fbbf24", text: "#fde68a" };
      case "use":
        return { fill: "#2e1065", stroke: "#a855f7", text: "#d8b4fe" };
      case "return_sink":
        return { fill: "#064e3b", stroke: "#34d399", text: "#a7f3d0" };
      default:
        return { fill: "#18181b", stroke: "#71717a", text: "#e4e4e7" };
    }
  };

  // Render edges
  const edgesSvg = (graph.edges || [])
    .map((edge) => {
      const src = positions[edge.source];
      const tgt = positions[edge.target];
      if (!src || !tgt) return "";

      const isGhost = edge.type === "ghost_flow";
      const stroke = isGhost ? "#f59e0b" : "#0891b2";
      const marker = isGhost ? "url(#arrow-amber)" : "url(#arrow-cyan)";

      const x1 = src.x + 120;
      const y1 = src.y;
      const x2 = tgt.x - nodeRadius - 4;
      const y2 = tgt.y;

      const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
      const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      return `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${isGhost ? 2 : 1.5}" stroke-opacity="0.75" marker-end="${marker}" />`;
    })
    .join("\n");

  // Render nodes
  const nodesSvg = Object.values(positions)
    .map(({ x, y, node }) => {
      const color = getNodeColor(node.kind);
      const labelText = node.label || node.symbol;
      const fileText = node.file.split("/").pop() || "";

      return `
      <g transform="translate(${x}, ${y})" style="font-family:ui-monospace, monospace;">
        <!-- Node Circle -->
        <circle cx="0" cy="0" r="${nodeRadius}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2" />
        <circle cx="0" cy="0" r="4" fill="${color.stroke}" />
        
        <!-- Label Beside Node -->
        <text x="${nodeRadius + 10}" y="-3" fill="#ffffff" font-size="11" font-weight="bold">${escapeXml(labelText)}</text>
        <text x="${nodeRadius + 10}" y="12" fill="#71717a" font-size="9">${escapeXml(fileText)} · L${node.line}</text>
        <text x="${nodeRadius + 10}" y="24" fill="${color.text}" font-size="8" font-weight="bold" letter-spacing="0.5">${node.kind.toUpperCase().replace("_", " ")}</text>
      </g>
    `;
    })
    .join("\n");

  return `<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="background-color:#050505;">
  <defs>
    <marker id="arrow-cyan" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
    </marker>
    <marker id="arrow-amber" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
    </marker>
    <pattern id="export-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#121212" stroke-width="1" />
    </pattern>
  </defs>

  <rect width="100%" height="100%" fill="url(#export-grid)" />

  <g transform="translate(10, 10)">
    ${edgesSvg}
    ${nodesSvg}
  </g>
</svg>`;
}

function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case "'":
          return "&apos;";
        case '"':
          return "&quot;";
        default:
          return c;
      }
    });
}
