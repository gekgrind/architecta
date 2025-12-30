/* ------------------------------------------------------------
 * Studio Modes
 * ---------------------------------------------------------- */
export type StudioMode = "blueprint" | "generate";

/* ------------------------------------------------------------
 * Suggestions
 * ---------------------------------------------------------- */
export interface Suggestion {
  id: string;
  label: string;
  action: "add-node" | "edit-node" | "delete-node";
}

/* ------------------------------------------------------------
 * Generated Content (versioned)
 * ---------------------------------------------------------- */
export interface GeneratedVersion {
  text: string;
  createdAt: string;
}

/* ------------------------------------------------------------
 * Content Node Data
 * ---------------------------------------------------------- */
export interface ContentNodeData {
  platform: string;
  idea: string;
  goal?: string;
  context?: string;

  generatedContent?: {
    [platform: string]: GeneratedVersion[];
  };
}

/* ------------------------------------------------------------
 * Selected Node
 * ---------------------------------------------------------- */
export interface SelectedNode {
  id: string;
  data: unknown;
}

/* ------------------------------------------------------------
 * Graph Types
 * ---------------------------------------------------------- */
export interface GraphNode {
  id: string;
  data: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/* ------------------------------------------------------------
 * Type Guard
 * ---------------------------------------------------------- */
export function isContentNodeData(
  data: unknown
): data is ContentNodeData {
  return (
    typeof data === "object" &&
    data !== null &&
    "platform" in data &&
    "idea" in data &&
    typeof (data as any).platform === "string" &&
    typeof (data as any).idea === "string"
  );
}
