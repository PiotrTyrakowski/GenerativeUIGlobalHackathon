"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/components/Canvas";
import { useCanvasMCP } from "@/hooks/useCanvasMCP";

const SSE_URL = process.env.NEXT_PUBLIC_CANVAS_SSE_URL || "http://localhost:3002/events";

function CanvasApp() {
  const { nodes, edges, onNodesChange, onEdgesChange, connected } =
    useCanvasMCP(SSE_URL);

  return (
    <div className="h-screen relative">
      <Canvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      />

      <div className="absolute top-4 left-4 flex items-center gap-2 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-400">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-neutral-600 animate-pulse"}`}
        />
        {connected
          ? "Connected — talk to Claude Code"
          : "Waiting for MCP server..."}
      </div>

      {nodes.length === 0 && connected && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2 max-w-md">
            <p className="text-neutral-500 text-sm">Canvas is empty</p>
            <p className="text-neutral-600 text-xs">
              Tell Claude Code to add things here. Try:
            </p>
            <p className="text-neutral-400 text-xs font-mono bg-neutral-900/60 rounded-lg px-4 py-2 inline-block">
              &quot;Add a project planning board with 5 tasks to the canvas&quot;
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
