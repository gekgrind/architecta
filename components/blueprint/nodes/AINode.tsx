import { Handle, Position } from "reactflow";

export default function AINode({ data }: any) {
  return (
    <div className="rounded-lg bg-indigo-500/20 border border-indigo-400/40 px-4 py-3 text-sm text-white">
      <div className="font-semibold mb-1">🤖 AI Node</div>
      <div className="text-xs text-white/70">
        {data.label ?? "Generate content"}
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
