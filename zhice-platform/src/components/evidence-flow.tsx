"use client";

import { useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap, type Edge, type Node, Position, useEdgesState, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
  { id: "rule", position: { x: 32, y: 56 }, data: { label: "评分细则\nAI 技术深度" }, style: { background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3" }, sourcePosition: Position.Right },
  { id: "evidence", position: { x: 238, y: 24 }, data: { label: "证据链\n可追溯" }, style: { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857" }, targetPosition: Position.Left, sourcePosition: Position.Right },
  { id: "agent", position: { x: 238, y: 124 }, data: { label: "Agent 工作流\n任务规划" }, style: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c" }, targetPosition: Position.Left, sourcePosition: Position.Right },
  { id: "artifact", position: { x: 460, y: 74 }, data: { label: "答辩交付物\n方案 + 任务" }, style: { background: "#f8fafc", border: "1px solid #cbd5e1", color: "#334155" }, targetPosition: Position.Left },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "rule", target: "evidence", animated: true, style: { stroke: "#818cf8" } },
  { id: "e2", source: "rule", target: "agent", animated: true, style: { stroke: "#fb923c" } },
  { id: "e3", source: "evidence", target: "artifact", animated: true, style: { stroke: "#34d399" } },
  { id: "e4", source: "agent", target: "artifact", animated: true, style: { stroke: "#fb923c" } },
];

export function EvidenceFlow() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback(() => undefined, []);
  return <div className="h-[242px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView fitViewOptions={{ padding: 0.4 }} nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} panOnScroll={false}><Background color="#cbd5e1" gap={18} size={1} /><Controls showInteractive={false} position="bottom-right" /><MiniMap pannable zoomable nodeColor={(node) => String(node.style?.color ?? "#64748b")} position="bottom-left" /></ReactFlow></div>;
}
