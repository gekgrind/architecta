import { Handle, Position } from "reactflow";

export default function OutputNode({ data }: any) {
  return (
    <div className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-4 py-3 text-sm text-white">
      <div className="font-semibold mb-1">📤 Output</div>
      <div className="text-xs text-white/70">
        {data.label ?? "Final output"}
      </div>

      <Handle type="target" position={Position.Left} />
    </div>
  );
}
