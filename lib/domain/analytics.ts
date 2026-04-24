import type { EntityId, IsoDateString } from "./common";
import type { ContentPerformanceSummary } from "./content";

export type AnalyticsSummary = {
  workspaceId?: EntityId | null;
  range?: {
    from: IsoDateString;
    to: IsoDateString;
  };
  totals: ContentPerformanceSummary;
  topContentIds: EntityId[];
};

export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type Campaign = {
  id: EntityId;
  workspaceId?: EntityId | null;
  name: string;
  status: CampaignStatus;
  goal?: string;
  contentIds: EntityId[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};
