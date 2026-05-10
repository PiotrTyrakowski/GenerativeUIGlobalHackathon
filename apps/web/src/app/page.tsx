"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { Canvas } from "@/components/Canvas";
import { useCanvasMCP } from "@/hooks/useCanvasMCP";

const SSE_URL = process.env.NEXT_PUBLIC_CANVAS_SSE_URL || "http://localhost:3002/events";

function CanvasApp() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    connected,
    persistNodeMove,
    applyMockAction,
    applyMockMessage,
  } =
    useCanvasMCP(SSE_URL);

  useEffect(() => {
    const handleAction = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        action?: string;
        nodeId?: string;
        node?: string;
      };
      if (!detail?.action || !detail.nodeId || !detail.node) return;
      applyMockAction({
        action: detail.action,
        nodeId: detail.nodeId,
        node: detail.node,
      });
    };

    window.addEventListener("company-brain-action", handleAction);
    return () =>
      window.removeEventListener("company-brain-action", handleAction);
  }, [applyMockAction]);

  useEffect(() => {
    const handleMessage = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        message?: string;
        nodeId?: string;
        node?: string;
      };
      if (!detail?.message || !detail.nodeId || !detail.node) return;
      applyMockMessage({
        message: detail.message,
        nodeId: detail.nodeId,
        node: detail.node,
      });
    };

    window.addEventListener("company-brain-message", handleMessage);
    return () =>
      window.removeEventListener("company-brain-message", handleMessage);
  }, [applyMockMessage]);

  return (
    <div className="h-screen relative">
      <Canvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={(_, node) => persistNodeMove(node)}
      />

      <div className="absolute top-4 left-4 max-w-[520px] bg-neutral-900/85 backdrop-blur-sm border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-600 animate-pulse"}`}
        />
        {connected
          ? "Connected — talk to Cursor through the local MCP tools"
          : "Waiting for MCP server..."}
        </div>
        <div className="mt-1 text-neutral-500">
          Mocked: sample wiki, deal, campaign, and retro data. Real: MCP state,
          SSE sync, and draggable canvas persistence.
        </div>
      </div>

      {nodes.length === 0 && connected && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2 max-w-md">
            <p className="text-neutral-500 text-sm">Canvas is empty</p>
            <p className="text-neutral-600 text-xs">
              Tell Claude Code to add things here. Try:
            </p>
            <p className="text-neutral-400 text-xs font-mono bg-neutral-900/60 rounded-lg px-4 py-2 inline-block">
              In Cursor: call company_brain_chat or show_company_brain
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ReactFlowProvider>
      <CanvasApp />
    </ReactFlowProvider>
  );
}
