import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type BaseNodeData = {
  label: string;
  content?: string;
};

const typeStyles: Record<string, { accent: string; border: string }> = {
  generic: { accent: "bg-blue-500", border: "border-blue-500/20" },
  note: { accent: "bg-amber-500", border: "border-amber-500/20" },
  task: { accent: "bg-emerald-500", border: "border-emerald-500/20" },
};

export function BaseNode({ data, type }: NodeProps<Node<BaseNodeData>>) {
  const style = typeStyles[type || "generic"] || typeStyles.generic;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-neutral-500 !border-neutral-700"
      />
      <div
        className={`bg-neutral-900 ${style.border} border rounded-xl shadow-xl min-w-[200px] max-w-[300px] overflow-hidden`}
      >
        <div className={`${style.accent} h-1`} />
        <div className="px-4 py-3">
          <div className="font-semibold text-sm text-neutral-100 leading-snug">
            {data.label}
          </div>
          {data.content && (
            <div className="mt-1.5 text-xs text-neutral-400 leading-relaxed">
              {data.content}
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
