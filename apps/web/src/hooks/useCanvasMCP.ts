"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";

type CompanyBrainMessage = {
  message: string;
  nodeId: string;
  node: string;
};

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

  const applyComponentMessage = useCallback(
    async ({ message, nodeId }: CompanyBrainMessage) => {
      const nextNodes: Node[] = nodesRef.current.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                status: "Message entered",
                metric: "Local preview",
                content: `Latest component message: "${message}". In Cursor/Claude MCP, this same field sends the message to chat from this component context.`,
                badges: Array.from(
                  new Set([
                    ...(((n.data as { badges?: string[] }).badges) ?? []),
                    "component message",
                  ]),
                ),
              },
            }
          : n,
      );

      await persistCanvasState(nextNodes, edgesRef.current);
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
    applyComponentMessage,
  };
}
