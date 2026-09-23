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

export type ContentStatus = "draft" | "published" | "scheduled" | "publishing" | "failed" | "archived";

export type ContentPerformanceSummary = {
  engagements: number;
  clicks?: number;
  impressions?: number;
};

export type ContentMediaKind = "image" | "video" | "storyboard";

export type ContentMedia = {
  kind: ContentMediaKind;
  /** Signed URL for an image preview (only set when kind === "image"). */
  imageUrl?: string;
  /** Signed URL for a playable video (only set when kind === "video"). */
  videoUrl?: string;
  /** Short label describing the asset for badges / a11y. */
  label?: string;
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
  media?: ContentMedia;
};
