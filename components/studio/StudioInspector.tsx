import {
  StudioMode,
  SelectedNode,
  Suggestion,
} from "./studioTypes";

interface StudioInspectorProps {
  mode: StudioMode;
  selectedNode: SelectedNode | null;
  suggestions: Suggestion[];
  onApplySuggestion: (s: Suggestion) => void;
  aiExplanation: {
    summary: string;
    steps: string[];
  } | null;
  onExplain: () => void;
  onGenerate: () => void;
}

export default function StudioInspector({
  mode,
  selectedNode,
  suggestions,
  onApplySuggestion,
  aiExplanation,
  onExplain,
  onGenerate,
}: StudioInspectorProps) {
  return (
    <div className="h-full p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-white/80">INSPECTOR</h2>

      {mode === "blueprint" && (
        <button
          onClick={onGenerate}
          className="px-3 py-2 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-sm"
        >
          ✨ Generate content from blueprint
        </button>
      )}

      {!selectedNode ? (
        <div className="text-sm text-white/40">Select a node</div>
      ) : (
        <>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => onApplySuggestion(s)}
              className="px-3 py-2 bg-white/5 rounded-md text-left"
            >
              {s.label}
            </button>
          ))}

          <button
            onClick={onExplain}
            className="mt-2 px-3 py-2 bg-indigo-500/20 rounded-md"
          >
            🧠 Explain blueprint
          </button>
        </>
      )}

      {aiExplanation && (
        <div className="text-sm space-y-2">
          <div>{aiExplanation.summary}</div>
          <ul className="list-disc list-inside">
            {aiExplanation.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
