import { Handle, Position } from "reactflow";

export default function DecisionNode({ data }: any) {
  return (
    <div className="rounded-lg bg-amber-500/20 border border-amber-400/40 px-4 py-3 text-sm text-white">
      <div className="font-semibold mb-1">🔀 Decision</div>
      <div className="text-xs text-white/70">
        {data.label ?? "Branch logic"}
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} id="yes" />
      <Handle type="source" position={Position.Bottom} id="no" />
    </div>
  );
}
