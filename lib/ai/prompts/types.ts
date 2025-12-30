// lib/types.ts

/**
 * ============================
 * Core Content Types
 * ============================
 * These define what kind of content Architecta can generate.
 * Keep these in sync with UI conditionals and generation logic.
 */

export const CONTENT_TYPES = [
  "tweet",
  "linkedin",
  "plain",
  "blog",
  "email",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * ============================
 * Generation Status
 * ============================
 */

export type GenerationStatus =
  | "idle"
  | "generating"
  | "success"
  | "error";

/**
 * ============================
 * Brand / Workspace Types
 * ============================
 */

export interface BrandKit {
  name: string;
  audience?: string;
  tone?: string;
  topics?: string[];
  bannedPhrases?: string[];
  examples?: string[];
}

/**
 * ============================
 * Content Record
 * ============================
 * Used for saved drafts, previews, and libraries
 */

export interface ContentItem {
  id: string;
  type: ContentType;
  content: string;
  createdAt: string;
  updatedAt?: string;
  brandId?: string;
}

/**
 * ============================
 * Generation Options
 * ============================
 */

export interface GenerationOptions {
  contentType: ContentType;
  prompt?: string;
  tone?: string;
  length?: "short" | "medium" | "long";
  callToAction?: boolean;
}

/**
 * ============================
 * API Responses
 * ============================
 */

export interface GenerationResponse {
  content: string;
  contentType: ContentType;
  status: GenerationStatus;
  error?: string;
}
