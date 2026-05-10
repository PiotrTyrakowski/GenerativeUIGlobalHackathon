"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";

type CompanyBrainAction = {
  action: string;
  nodeId: string;
  node: string;
};

type CompanyBrainMessage = {
  message: string;
  nodeId: string;
  node: string;
};

function mockedActionResult(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("apply")) {
    return {
      status: "Mock applied",
      content:
        "Mock action applied. The wiki learning, affected component state, and downstream canvas refresh are simulated for the demo.",
      metric: "Applied",
    };
  }

  if (normalized.includes("draft") || normalized.includes("generate")) {
    return {
      status: "Mock draft ready",
      content:
        "Mock draft generated using the founder voice rules and current wiki context. No email was sent.",
      metric: "Draft ready",
    };
  }

  if (normalized.includes("create") || normalized.includes("enrich")) {
    return {
      status: "Mock enrichment complete",
      content:
        "Mock enrichment produced selected targets, signal scores, and suggested campaign angles.",
      metric: "Mock data",
    };
  }

  if (normalized.includes("prep") || normalized.includes("view") || normalized.includes("open")) {
    return {
      status: "Mock brief opened",
      content:
        "Mock detail view created from the relevant wiki pages and source records.",
      metric: "Opened",
    };
  }

  return {
    status: "Mock action complete",
    content:
      "Mock interaction completed. This updates local demo state only until the real tool is implemented.",
    metric: "Done",
  };
}

export function useCanvasMCP(sseUrl: string) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [connected, setConnected] = useState(false);
  const { fitView } = useReactFlow();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  useEffect(() => {
    const es = new EventSource(sseUrl);

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type !== "STATE_SNAPSHOT" || !event.snapshot) return;

        const hadNodes = nodesRef.current.length > 0;
        const { nodes: newNodes, edges: newEdges } = event.snapshot;

        if (newNodes) {
          setNodes(
            newNodes.map(
              (n: {
                id: string;
                type?: string;
                position: { x: number; y: number };
                data: Record<string, unknown>;
                style?: Record<string, unknown>;
              }) => ({
                id: n.id,
                type: n.type || "generic",
                position: n.position,
                data: n.data,
                style: n.style as React.CSSProperties | undefined,
              }),
            ),
          );
        }

        if (newEdges) {
          setEdges(
            newEdges.map(
              (e: {
                id: string;
                source: string;
                target: string;
                label?: string;
              }) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                animated: true,
              }),
            ),
          );
        }

        if (!hadNodes && newNodes?.length > 0) {
          setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 100);
        }
      } catch {
        // ignore malformed events
      }
    };

    return () => es.close();
  }, [sseUrl, setNodes, setEdges, fitView]);

  const persistCanvasState = useCallback(
    async (nextNodes: Node[], nextEdges: Edge[]) => {
      setNodes(nextNodes);
      setEdges(nextEdges);

      const stateUrl = sseUrl.replace(/\/events$/, "/state");
      try {
        await fetch(stateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodes: nextNodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
              style: n.style,
            })),
            edges: nextEdges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.label,
            })),
          }),
        });
      } catch {
        // The canvas remains interactive even if the local MCP SSE server is down.
      }
    },
    [sseUrl, setNodes],
  );

  const persistNodeMove = useCallback(
    async (node: Node) => {
      const nextNodes = nodesRef.current.map((n) =>
        n.id === node.id ? { ...n, position: node.position } : n,
      );
      await persistCanvasState(nextNodes, edgesRef.current);
    },
    [persistCanvasState],
  );

  const applyMockAction = useCallback(
    async ({ action, nodeId, node }: CompanyBrainAction) => {
      const result = mockedActionResult(action);
      const sourceNode = nodesRef.current.find((n) => n.id === nodeId);
      const noteId = `mock-${crypto.randomUUID().slice(0, 8)}`;
      const notePosition = sourceNode
        ? { x: sourceNode.position.x + 390, y: sourceNode.position.y + 40 }
        : { x: 120, y: 120 };

      const nextNodes: Node[] = [
        ...nodesRef.current.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: result.status,
                  metric: result.metric,
                  content: result.content,
                  badges: Array.from(
                    new Set([
                      ...(((n.data as { badges?: string[] }).badges) ?? []),
                      "mock-clicked",
                    ]),
                  ),
                },
              }
            : n,
        ),
        {
          id: noteId,
          type: "note",
          position: notePosition,
          data: {
            label: `Mock action: ${action}`,
            metric: "Simulated",
            status: "No external side effect",
            content: `Clicked from ${node}. This is a local demo action; it did not call Clay, send email, write files, or update a real wiki.`,
            badges: ["demo only"],
          },
        },
      ];

      const nextEdges: Edge[] = [
        ...edgesRef.current,
        {
          id: `edge-${noteId}`,
          source: nodeId,
          target: noteId,
          label: "mock action",
          animated: true,
        },
      ];

      await persistCanvasState(nextNodes, nextEdges);
    },
    [persistCanvasState],
  );

  const applyMockMessage = useCallback(
    async ({ message, nodeId, node }: CompanyBrainMessage) => {
      const sourceNode = nodesRef.current.find((n) => n.id === nodeId);
      const noteId = `reply-${crypto.randomUUID().slice(0, 8)}`;
      const notePosition = sourceNode
        ? { x: sourceNode.position.x + 390, y: sourceNode.position.y + 120 }
        : { x: 120, y: 180 };

      const nextNodes: Node[] = [
        ...nodesRef.current.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: "Mock message sent",
                  metric: "Local preview",
                  badges: Array.from(
                    new Set([
                      ...(((n.data as { badges?: string[] }).badges) ?? []),
                      "message-sent",
                    ]),
                  ),
                },
              }
            : n,
        ),
        {
          id: noteId,
          type: "note",
          position: notePosition,
          data: {
            label: `Mock Cursor reply: ${node}`,
            metric: "Preview only",
            status: "Not sent to Cursor",
            content: `You asked: "${message}". In Cursor/Claude MCP, this message box sends a real follow-up chat turn from the component. In this standalone web preview, it creates this mocked reply node instead.`,
            badges: ["demo only", "component chat"],
          },
        },
      ];

      const nextEdges: Edge[] = [
        ...edgesRef.current,
        {
          id: `edge-${noteId}`,
          source: nodeId,
          target: noteId,
          label: "component message",
          animated: true,
        },
      ];

      await persistCanvasState(nextNodes, nextEdges);
    },
    [persistCanvasState],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    connected,
    persistNodeMove,
    applyMockAction,
    applyMockMessage,
  };
}
