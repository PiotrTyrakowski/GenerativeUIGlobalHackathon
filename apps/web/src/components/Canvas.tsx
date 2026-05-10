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
  type OnNodeDrag,
  BackgroundVariant,
} from "@xyflow/react";
import { useMemo } from "react";
import { BaseNode } from "./nodes/BaseNode";

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeDragStop?: OnNodeDrag;
}

export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeDragStop,
}: CanvasProps) {
  const nodeTypes = useMemo(
    () => ({
      generic: BaseNode,
      note: BaseNode,
      task: BaseNode,
      wiki: BaseNode,
      brief: BaseNode,
      ingest: BaseNode,
      engagement: BaseNode,
      hypothesis: BaseNode,
      prospect: BaseNode,
      campaign: BaseNode,
      retro: BaseNode,
    }),
    [],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
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
