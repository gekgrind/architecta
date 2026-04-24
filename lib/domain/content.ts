import type { EntityId, IsoDateString } from "./common";

export type ContentType =
  | "tweet"
  | "thread"
  | "linkedin"
  | "linkedin_post"
  | "blog"
  | "blog_outline"
  | "blog_post"
  | "article_longform"
  | "email"
  | "ad"
  | "ad_copy"
  | "landing_page"
  | "product_description";

export type ContentStatus = "draft" | "published" | "scheduled" | "archived";

export type ContentPerformanceSummary = {
  engagements: number;
  clicks?: number;
  impressions?: number;
};

export type ContentItem = {
  id: EntityId;
  contentType: ContentType;
  status: ContentStatus;
  title: string;
  content: string;
  cta?: string;
  createdAt: IsoDateString;
  updatedAt?: IsoDateString;
  publishedAt?: IsoDateString;
  performanceData?: ContentPerformanceSummary;
  campaign?: string;
  brandName?: string;
  tags?: string[];
};
