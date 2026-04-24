import type { EntityId, IsoDateString } from "./common";

export type ArchitectaUser = {
  id: EntityId;
  email?: string;
};

export type ArchitectaSessionUser = {
  user: ArchitectaUser;
};

export type UserProfile = {
  id: EntityId;
  email?: string;
  onboardingComplete: boolean;
  defaultWorkspaceId?: EntityId | null;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};
