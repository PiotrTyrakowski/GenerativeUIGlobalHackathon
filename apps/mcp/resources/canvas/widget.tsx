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
    status: z.string().optional(),
    metric: z.string().optional(),
    source: z.string().optional(),
    badges: z.array(z.string()).optional(),
    actions: z.array(z.string()).optional(),
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
  wiki: "#64748b",
  brief: "#14b8a6",
  ingest: "#f59e0b",
  engagement: "#3b82f6",
  hypothesis: "#8b5cf6",
  prospect: "#22c55e",
  campaign: "#ef4444",
  retro: "#06b6d4",
};

type BaseNodeData = {
  label: string;
  content?: string;
  status?: string;
  metric?: string;
  source?: string;
  badges?: string[];
  actions?: string[];
};

function mockedActionResult(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("apply")) {
    return {
      status: "Mock applied",
      metric: "Applied",
      content:
        "Mock action applied. Wiki learning, affected component state, and downstream canvas refresh are simulated.",
    };
  }

  if (normalized.includes("draft") || normalized.includes("generate")) {
    return {
      status: "Mock draft ready",
      metric: "Draft ready",
      content:
        "Mock draft generated using founder voice rules and current wiki context. No message was sent.",
    };
  }

  if (normalized.includes("create") || normalized.includes("enrich")) {
    return {
      status: "Mock enrichment complete",
      metric: "Mock data",
      content:
        "Mock enrichment produced selected targets, signal scores, and suggested campaign angles.",
    };
  }

  if (normalized.includes("prep") || normalized.includes("view") || normalized.includes("open")) {
    return {
      status: "Mock brief opened",
      metric: "Opened",
      content:
        "Mock detail view created from the relevant wiki pages and source records.",
    };
  }

  return {
    status: "Mock action complete",
    metric: "Done",
    content:
      "Mock interaction completed. This updates local demo state only until the real tool exists.",
  };
}

function BaseNode({
  id,
  data,
  type,
  onAction,
}: NodeProps<Node<BaseNodeData>> & {
  onAction?: (payload: { action: string; nodeId: string; node: string }) => void;
}) {
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
          borderRadius: 8,
          minWidth: 260,
          maxWidth: 340,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ height: 3, background: accent }} />
        <div style={{ padding: "10px 14px" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "#f5f5f5",
              lineHeight: 1.3,
            }}
          >
            {data.label}
          </div>
          {(data.metric || data.status) && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {data.metric && (
                <span style={{ color: accent, fontSize: 16, fontWeight: 700 }}>
                  {data.metric}
                </span>
              )}
              {data.status && (
                <span
                  style={{
                    color: "#d4d4d4",
                    background: "#262626",
                    border: "1px solid #3f3f46",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 10,
                  }}
                >
                  {data.status}
                </span>
              )}
            </div>
          )}
          {data.content && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#d4d4d4",
                lineHeight: 1.5,
              }}
            >
              {data.content}
            </div>
          )}
          {data.badges && data.badges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {data.badges.map((badge) => (
                <span
                  key={badge}
                  style={{
                    border: "1px solid #404040",
                    borderRadius: 999,
                    color: "#a3a3a3",
                    fontSize: 10,
                    padding: "2px 7px",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          {data.actions && data.actions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {data.actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() =>
                    onAction?.({ action, nodeId: id, node: data.label })
                  }
                  style={{
                    background: "#262626",
                    border: "1px solid #404040",
                    borderRadius: 6,
                    color: "#f5f5f5",
                    fontSize: 10,
                    padding: "4px 7px",
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
          {data.source && (
            <div style={{ marginTop: 10, color: "#737373", fontSize: 10 }}>
              Source: {data.source}
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

  const onAction = useCallback(
    ({
      action,
      nodeId,
      node,
    }: {
      action: string;
      nodeId: string;
      node: string;
    }) => {
      const result = mockedActionResult(action);
      const sourceNode = nodes.find((n) => n.id === nodeId);
      const noteId = `mock-${Math.random().toString(16).slice(2, 10)}`;
      const notePosition = sourceNode
        ? { x: sourceNode.position.x + 390, y: sourceNode.position.y + 40 }
        : { x: 120, y: 120 };

      setNodes((currentNodes) => [
        ...currentNodes.map((currentNode) =>
          currentNode.id === nodeId
            ? {
                ...currentNode,
                data: {
                  ...currentNode.data,
                  status: result.status,
                  metric: result.metric,
                  content: result.content,
                  badges: Array.from(
                    new Set([
                      ...(((currentNode.data as BaseNodeData).badges) ?? []),
                      "mock-clicked",
                    ]),
                  ),
                },
              }
            : currentNode,
        ),
        {
          id: noteId,
          type: "note",
          position: notePosition,
          data: {
            label: `Mock action: ${action}`,
            metric: "Simulated",
            status: "No external side effect",
            content: `Clicked from ${node}. This local widget action did not call Clay, send email, write files, or update a real wiki.`,
            badges: ["demo only"],
          },
        },
      ]);
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: `edge-${noteId}`,
          source: nodeId,
          target: noteId,
          label: "mock action",
          animated: true,
        },
      ]);
    },
    [nodes],
  );

  const nodeTypes = useMemo(
    () => {
      const ActionNode = (props: NodeProps<Node<BaseNodeData>>) => (
        <BaseNode {...props} onAction={onAction} />
      );
      return {
        generic: ActionNode,
        note: ActionNode,
        task: ActionNode,
        wiki: ActionNode,
        brief: ActionNode,
        ingest: ActionNode,
        engagement: ActionNode,
        hypothesis: ActionNode,
        prospect: ActionNode,
        campaign: ActionNode,
        retro: ActionNode,
      };
    },
    [onAction],
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
      (moveTool.callTool as (args: {
        id: string;
        position: { x: number; y: number };
      }) => void)({ id: node.id, position: node.position });
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
