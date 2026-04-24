import type { EntityId, IsoDateString } from "./common";

export type AudienceProfile = {
  demographics?: string;
  painPoints?: string[];
  goals?: string[];
};

export type BrandTopicSet = {
  include?: string[];
  avoid?: string[];
};

export type ExamplePost = {
  id: EntityId;
  type: string;
  content?: string;
  whyItWorks?: string;
  title?: string;
  createdAt?: IsoDateString;
  created_at?: IsoDateString;
};

export type FounderProfile = {
  id?: EntityId;
  userId: EntityId;
  workspaceId?: EntityId | null;
  profileText: string;
  confidenceScore: number;
  version: number;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};

export type BusinessProfile = {
  id?: EntityId;
  userId?: EntityId;
  workspaceId?: EntityId | null;
  brandName: string;
  industry?: string;
  website?: string;
  description?: string;
  audience?: string;
  targetAudience?: AudienceProfile;
  tone?: string;
  toneAttributes?: string[];
  voiceDescription?: string;
  topics?: string[] | BrandTopicSet;
  bannedPhrases?: string[];
  requiredElements?: string[];
  examples?: string[];
  examplePosts?: ExamplePost[];
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
};

export type BrandKit = BusinessProfile;
