import type { EntityId, IsoDateString } from "./common";

export type StudioMode = "blueprint" | "generate";

export type GeneratedVersion = {
  text: string;
  createdAt: IsoDateString;
};

export type GeneratedContentMap = Record<string, GeneratedVersion[]>;

export type ContentNodeData = {
  platform: string;
  idea: string;
  goal?: string;
  context?: string;
  generatedContent?: GeneratedContentMap;
};

export type StudioGraphNode = {
  id: EntityId;
  data: unknown;
  position: { x: number; y: number };
  type?: string;
};

export type StudioGraphEdge = {
  id: EntityId;
  source: EntityId;
  target: EntityId;
};

export type StudioGraph = {
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
};

export type StudioGraphRecord = {
  id?: EntityId;
  userId: EntityId;
  workspaceId?: EntityId | null;
  graph: StudioGraph;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};

export type StudioSaveRequest = {
  graph: StudioGraph;
  meta?: {
    workspaceId?: EntityId | null;
    mode?: StudioMode;
    updatedAt?: IsoDateString;
  };
  memorySignals?: MemorySignal[];
};

export type StudioLoadResponse = {
  graph: StudioGraphRecord;
};

export type Suggestion = {
  id: EntityId;
  label: string;
  action: "add-node" | "edit-node" | "delete-node";
};

export type SelectedNode = {
  id: EntityId;
  data: unknown;
};

export type MemorySignal = {
  signalType: "tone" | "length" | "cta" | "structure" | string;
  signalValue: string;
  confidence?: number;
  source?: "architecta" | "prospra" | string;
};

export function isStudioGraph(value: unknown): value is StudioGraph {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { nodes?: unknown }).nodes) &&
    Array.isArray((value as { edges?: unknown }).edges)
  );
}

export function isContentNodeData(data: unknown): data is ContentNodeData {
  return (
    typeof data === "object" &&
    data !== null &&
    "platform" in data &&
    "idea" in data &&
    typeof (data as { platform?: unknown }).platform === "string" &&
    typeof (data as { idea?: unknown }).idea === "string"
  );
}
