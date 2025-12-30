"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";

type ContentNodeData = {
  platform: string;
  idea: string;
  goal?: string;
  context?: string;
};

type ContentNodeProps = {
  data: ContentNodeData;
  selected?: boolean;
};

function ContentNode({ data, selected }: ContentNodeProps) {
  return (
    <div
      className={[
        "min-w-[220px] max-w-[260px] rounded-lg border",
        "bg-slate-900/80 backdrop-blur-md",
        "px-4 py-3 text-sm shadow-lg",
        selected
          ? "border-emerald-400 ring-1 ring-emerald-400/40"
          : "border-slate-700",
      ].join(" ")}
    >
      {/* Incoming connection */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-500"
      />

      {/* Node header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
          Content
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
          {data.platform}
        </span>
      </div>

      {/* Main idea */}
      <div className="text-slate-100 font-medium leading-snug">
        {data.idea || "Untitled idea"}
      </div>

      {/* Optional meta */}
      {(data.goal || data.context) && (
        <div className="mt-2 space-y-1 text-xs text-slate-400">
          {data.goal && <div>🎯 {data.goal}</div>}
          {data.context && <div>🧠 {data.context}</div>}
        </div>
      )}

      {/* Outgoing connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-400"
      />
    </div>
  );
}

export default memo(ContentNode);
