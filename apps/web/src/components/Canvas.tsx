"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
} from "@xyflow/react";
import { useMemo } from "react";
import { BaseNode } from "./nodes/BaseNode";

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
}

export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}: CanvasProps) {
  const nodeTypes = useMemo(() => ({ generic: BaseNode, note: BaseNode, task: BaseNode }), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      colorMode="dark"
      defaultEdgeOptions={{ animated: true }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#262626" />
      <Controls className="!bg-neutral-900 !border-neutral-700 !shadow-lg" />
      <MiniMap
        className="!bg-neutral-900 !border-neutral-700"
        nodeColor="#3b82f6"
        maskColor="rgba(0, 0, 0, 0.6)"
      />
    </ReactFlow>
  );
}
