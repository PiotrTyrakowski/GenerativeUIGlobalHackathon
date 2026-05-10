"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type BaseNodeData = {
  label: string;
  content?: string;
  status?: string;
  metric?: string;
  source?: string;
  badges?: string[];
  actions?: string[];
};

const typeStyles: Record<string, { accent: string; border: string }> = {
  generic: { accent: "bg-blue-500", border: "border-blue-500/20" },
  note: { accent: "bg-amber-500", border: "border-amber-500/20" },
  task: { accent: "bg-emerald-500", border: "border-emerald-500/20" },
  wiki: { accent: "bg-slate-500", border: "border-slate-500/20" },
  brief: { accent: "bg-teal-500", border: "border-teal-500/20" },
  ingest: { accent: "bg-amber-500", border: "border-amber-500/20" },
  engagement: { accent: "bg-blue-500", border: "border-blue-500/20" },
  hypothesis: { accent: "bg-violet-500", border: "border-violet-500/20" },
  prospect: { accent: "bg-green-500", border: "border-green-500/20" },
  campaign: { accent: "bg-red-500", border: "border-red-500/20" },
  retro: { accent: "bg-cyan-500", border: "border-cyan-500/20" },
};

export function BaseNode({ id, data, type }: NodeProps<Node<BaseNodeData>>) {
  const style = typeStyles[type || "generic"] || typeStyles.generic;
  const [message, setMessage] = useState("");

  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    window.dispatchEvent(
      new CustomEvent("company-brain-message", {
        detail: { message: text, nodeId: id, node: data.label },
      }),
    );
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-neutral-500 !border-neutral-700"
      />
      <div
        className={`bg-neutral-900 ${style.border} border rounded-lg shadow-xl min-w-[260px] max-w-[340px] overflow-hidden`}
      >
        <div className={`${style.accent} h-1`} />
        <div className="px-4 py-3">
          <div className="font-semibold text-sm text-neutral-100 leading-snug">
            {data.label}
          </div>
          {(data.metric || data.status) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {data.metric && (
                <div className="text-base font-bold text-neutral-50">
                  {data.metric}
                </div>
              )}
              {data.status && (
                <div className="rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300">
                  {data.status}
                </div>
              )}
            </div>
          )}
          {data.content && (
            <div className="mt-1.5 text-xs text-neutral-400 leading-relaxed">
              {data.content}
            </div>
          )}
          {data.badges && data.badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          <div
            className="mt-3 border-t border-neutral-800 pt-3"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-neutral-500">
              Message from this component
            </div>
            <div className="flex gap-1.5">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendMessage();
                }}
                placeholder="Ask Cursor..."
                className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-[11px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!message.trim()}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-[11px] text-neutral-100 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
          {data.source && (
            <div className="mt-3 text-[10px] text-neutral-600">
              Source: {data.source}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-neutral-500 !border-neutral-700"
      />
    </>
  );
}
