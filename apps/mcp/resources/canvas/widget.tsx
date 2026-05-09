import {
  McpUseProvider,
  useWidget,
  useCallTool,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BackgroundVariant,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeProps,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const nodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    content: z.string().optional(),
  }),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
});

export const propSchema = z.object({
  nodes: z
    .array(nodeSchema)
    .default([])
    .describe("Canvas nodes with positions and data"),
  edges: z
    .array(edgeSchema)
    .default([])
    .describe("Directed edges between nodes"),
});

export type CanvasWidgetProps = z.infer<typeof propSchema>;

export const widgetMetadata: WidgetMetadata = {
  description: "Interactive infinite canvas with draggable nodes and edges",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Rendering canvas…",
    invoked: "Canvas ready",
  },
};

// ---------------------------------------------------------------------------
// Custom node component
// ---------------------------------------------------------------------------

const ACCENTS: Record<string, string> = {
  generic: "#3b82f6",
  note: "#f59e0b",
  task: "#10b981",
};

type BaseNodeData = { label: string; content?: string };

function BaseNode({ data, type }: NodeProps<Node<BaseNodeData>>) {
  const accent = ACCENTS[type || "generic"] || ACCENTS.generic;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: "#6b7280",
          border: "2px solid #374151",
        }}
      />
      <div
        style={{
          background: "#171717",
          border: "1px solid #2e2e2e",
          borderRadius: 12,
          minWidth: 180,
          maxWidth: 280,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ height: 3, background: accent }} />
        <div style={{ padding: "10px 14px" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: "#f5f5f5",
              lineHeight: 1.3,
            }}
          >
            {data.label}
          </div>
          {data.content && (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "#a3a3a3",
                lineHeight: 1.5,
              }}
            >
              {data.content}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: "#6b7280",
          border: "2px solid #374151",
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Canvas inner (needs ReactFlowProvider above it)
// ---------------------------------------------------------------------------

function CanvasInner({
  initialNodes,
  initialEdges,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
}) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const moveTool = useCallTool("move_node");

  const nodeTypes = useMemo(
    () => ({ generic: BaseNode, note: BaseNode, task: BaseNode }),
    [],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      moveTool.callTool({ id: node.id, position: node.position });
    },
    [moveTool],
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
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#262626"
      />
      <Controls
        style={{
          background: "#171717",
          border: "1px solid #2e2e2e",
          borderRadius: 8,
        }}
      />
      <MiniMap
        style={{ background: "#171717", border: "1px solid #2e2e2e" }}
        nodeColor="#3b82f6"
        maskColor="rgba(0,0,0,0.6)"
      />
    </ReactFlow>
  );
}

// ---------------------------------------------------------------------------
// Widget entry point
// ---------------------------------------------------------------------------

const CanvasWidget: React.FC = () => {
  const { props, isPending } = useWidget<CanvasWidgetProps>();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div
          style={{
            padding: 32,
            color: "#737373",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          Rendering canvas…
        </div>
      </McpUseProvider>
    );
  }

  const rawNodes = props?.nodes ?? [];
  const rawEdges = props?.edges ?? [];

  const initialNodes: Node[] = rawNodes.map((n) => ({
    id: n.id,
    type: n.type || "generic",
    position: n.position,
    data: n.data,
  }));

  const initialEdges: Edge[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
  }));

  const empty = initialNodes.length === 0;

  return (
    <McpUseProvider autoSize>
      <div style={{ padding: 8 }}>
        <div
          style={{
            width: "100%",
            height: empty ? 200 : 480,
            borderRadius: 12,
            overflow: "hidden",
            background: "#0a0a0a",
            border: "1px solid #2e2e2e",
          }}
        >
          <ReactFlowProvider>
            {empty ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#525252",
                  fontSize: 13,
                }}
              >
                Canvas is empty — ask Claude to add nodes
              </div>
            ) : (
              <CanvasInner
                initialNodes={initialNodes}
                initialEdges={initialEdges}
              />
            )}
          </ReactFlowProvider>
        </div>
        {!empty && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#737373",
              textAlign: "right",
            }}
          >
            {initialNodes.length} node{initialNodes.length !== 1 ? "s" : ""} ·{" "}
            {initialEdges.length} edge{initialEdges.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </McpUseProvider>
  );
};

export default CanvasWidget;
