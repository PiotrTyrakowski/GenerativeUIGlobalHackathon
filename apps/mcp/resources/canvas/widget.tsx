import {
  McpUseProvider,
  useWidget,
  useCallTool,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
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

function BaseNode({
  id,
  data,
  type,
  onAction,
  onSendMessage,
}: NodeProps<Node<BaseNodeData>> & {
  onAction?: (payload: { action: string; nodeId: string; node: string }) => void;
  onSendMessage?: (payload: {
    message: string;
    nodeId: string;
    node: string;
  }) => void;
}) {
  const accent = ACCENTS[type || "generic"] || ACCENTS.generic;
  const [message, setMessage] = useState("");

  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    onSendMessage?.({ message: text, nodeId: id, node: data.label });
  };

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
                  onClick={() => onAction?.({ action, nodeId: id, node: data.label })}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{
                    background: "#262626",
                    border: "1px solid #404040",
                    borderRadius: 6,
                    color: "#f5f5f5",
                    fontSize: 10,
                    padding: "4px 7px",
                    cursor: "pointer",
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
          <div
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid #262626",
            }}
          >
            <div
              style={{
                marginBottom: 6,
                color: "#737373",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 0,
              }}
            >
              Message from this component
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendMessage();
                }}
                placeholder="Ask Cursor..."
                style={{
                  minWidth: 0,
                  flex: 1,
                  background: "#0a0a0a",
                  border: "1px solid #404040",
                  borderRadius: 6,
                  color: "#f5f5f5",
                  fontSize: 11,
                  padding: "7px 8px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!message.trim()}
                style={{
                  background: message.trim() ? "#262626" : "#171717",
                  border: "1px solid #404040",
                  borderRadius: 6,
                  color: message.trim() ? "#f5f5f5" : "#737373",
                  fontSize: 11,
                  padding: "7px 9px",
                }}
              >
                Send
              </button>
            </div>
          </div>
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

function canvasSyncKey(nodes: Node[], edges: Edge[]) {
  const n = [...nodes]
    .map((node) => `${node.id}:${JSON.stringify(node.position)}:${JSON.stringify(node.data)}`)
    .sort()
    .join("|");
  const e = [...edges]
    .map((edge) => `${edge.id}:${edge.source}->${edge.target}:${edge.label ?? ""}`)
    .sort()
    .join(";");
  return `${n}#${e}`;
}

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
  const { sendFollowUpMessage, setState } = useWidget<CanvasWidgetProps>();

  const propsSyncKey = useMemo(
    () => canvasSyncKey(initialNodes, initialEdges),
    [initialNodes, initialEdges],
  );

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [propsSyncKey, initialNodes, initialEdges]);

  const onAction = useCallback(
    async ({ action, nodeId, node }: { action: string; nodeId: string; node: string }) => {
      const sourceNode = nodes.find((n) => n.id === nodeId);
      const nodeData = sourceNode?.data as BaseNodeData | undefined;
      const context = nodeData
        ? `Node "${node}" (${nodeId}, type: ${sourceNode?.type}). Status: ${nodeData.status || "none"}. Metric: ${nodeData.metric || "none"}. Content: ${nodeData.content || "none"}.`
        : `Node "${node}" (${nodeId}).`;

      setNodes((cur) =>
        cur.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: `${action}…` } } : n)),
      );

      await sendFollowUpMessage(
        `User clicked action "${action}" on canvas component "${node}" (${nodeId}).\n\nContext: ${context}\n\nExecute this action using canvas tools. Update the node status/content to reflect the result, and render the updated canvas with show_canvas.`,
      );
    },
    [nodes, sendFollowUpMessage],
  );

  const onSendMessage = useCallback(
    async ({ message, nodeId, node }: { message: string; nodeId: string; node: string }) => {
      setNodes((cur) =>
        cur.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: "Sent to chat", metric: "Awaiting answer" } }
            : n,
        ),
      );

      await setState({ activeComponent: node, activeComponentId: nodeId, lastComponentMessage: message });
      await sendFollowUpMessage(
        `From Company Brain component "${node}" (${nodeId}): ${message}\n\nAnswer in chat using this component as the active context. If the canvas should change, call the existing canvas tools and then render the updated canvas.`,
      );
    },
    [sendFollowUpMessage, setState],
  );

  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const onSendMessageRef = useRef(onSendMessage);
  onSendMessageRef.current = onSendMessage;

  const nodeTypes = useMemo(() => {
    const ActionNode = (props: NodeProps<Node<BaseNodeData>>) => (
      <BaseNode
        {...props}
        onAction={(p) => onActionRef.current(p)}
        onSendMessage={(p) => onSendMessageRef.current(p)}
      />
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
  }, []);

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
