import type { EntityId, IsoDateString } from "./common";

export type Workspace = {
  id: EntityId;
  userId: EntityId;
  name: string;
  llmPreference?: "auto" | "openai" | "anthropic";
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};

export type ProjectStatus = "draft" | "active" | "archived";

export type Project = {
  id: EntityId;
  workspaceId: EntityId;
  userId: EntityId;
  name: string;
  status: ProjectStatus;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};
