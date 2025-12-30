import { StudioMode } from "./studioTypes";

interface Props {
  mode: StudioMode;
  onModeChange: (m: StudioMode) => void;
}

export default function StudioSidebar({ mode, onModeChange }: Props) {
  return (
    <div className="p-4 space-y-2">
      {(["blueprint", "generate", "refine"] as StudioMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={`block w-full text-left px-3 py-2 rounded ${
            mode === m ? "bg-white/10" : "bg-transparent"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
