"use client";

import { useState, useCallback, useRef } from "react";
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useCanvasAgent(agentUrl: string) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const { fitView } = useReactFlow();

  const chatRef = useRef(chatMessages);
  chatRef.current = chatMessages;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const wasEmptyRef = useRef(true);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };

      const allMessages = [...chatRef.current, userMsg];
      setChatMessages(allMessages);
      setIsRunning(true);
      setStreamingText("");

      const runInput = {
        threadId: "main",
        runId: crypto.randomUUID(),
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        state: {
          nodes: nodesRef.current.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
          edges: edgesRef.current.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: (e as Edge & { label?: string }).label,
          })),
        },
      };

      let streamBuf = "";
      let streamMsgId = "";

      try {
        const res = await fetch(agentUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(runInput),
        });

        if (!res.ok) throw new Error(`Agent returned ${res.status}`);
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(json);
            } catch {
              continue;
            }

            switch (event.type) {
              case "TEXT_MESSAGE_START":
                streamMsgId = event.messageId as string;
                streamBuf = "";
                break;

              case "TEXT_MESSAGE_CONTENT":
                streamBuf += event.delta as string;
                setStreamingText(streamBuf);
                break;

              case "TEXT_MESSAGE_END":
                if (streamBuf) {
                  setChatMessages((prev) => [
                    ...prev,
                    {
                      id: streamMsgId,
                      role: "assistant",
                      content: streamBuf,
                    },
                  ]);
                }
                setStreamingText("");
                streamBuf = "";
                break;

              case "STATE_SNAPSHOT": {
                const snapshot = event.snapshot as {
                  nodes?: Array<{
                    id: string;
                    type?: string;
                    position: { x: number; y: number };
                    data: Record<string, unknown>;
                    style?: Record<string, unknown>;
                  }>;
                  edges?: Array<{
                    id: string;
                    source: string;
                    target: string;
                    label?: string;
                  }>;
                };

                if (snapshot?.nodes) {
                  const hadNodes = nodesRef.current.length > 0;
                  setNodes(
                    snapshot.nodes.map((n) => ({
                      id: n.id,
                      type: n.type || "generic",
                      position: n.position,
                      data: n.data,
                      style: n.style as React.CSSProperties | undefined,
                    })),
                  );
                  if (!hadNodes && snapshot.nodes.length > 0) {
                    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
                  }
                }
                if (snapshot?.edges) {
                  setEdges(
                    snapshot.edges.map((e) => ({
                      id: e.id,
                      source: e.source,
                      target: e.target,
                      label: e.label,
                      animated: true,
                    })),
                  );
                }
                break;
              }
            }
          }
        }
      } catch (err) {
        console.error("Agent error:", err);
        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Connection failed"}`,
          },
        ]);
      } finally {
        if (streamBuf) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: streamMsgId || crypto.randomUUID(),
              role: "assistant",
              content: streamBuf,
            },
          ]);
          setStreamingText("");
        }
        setIsRunning(false);
      }
    },
    [agentUrl, setNodes, setEdges, fitView],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    chatMessages,
    isRunning,
    streamingText,
    sendMessage,
  };
}
