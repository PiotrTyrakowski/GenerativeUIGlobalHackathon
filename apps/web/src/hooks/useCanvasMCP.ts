"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";

export function useCanvasMCP(sseUrl: string) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [connected, setConnected] = useState(false);
  const { fitView } = useReactFlow();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

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

  return { nodes, edges, onNodesChange, onEdgesChange, connected };
}
