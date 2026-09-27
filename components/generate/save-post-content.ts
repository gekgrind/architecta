import {
  composePostText,
  toPostContentPatch,
  type PostTextFields,
} from "@/lib/publishing/post-text";

export type SavedPost = PostTextFields & { id: string };

/** True when the editor text is exactly what the server last confirmed for this post. */
export function matchesSavedPost(content: string, saved: PostTextFields | null): boolean {
  return !!saved && content.trim() === composePostText(saved).trim();
}

export type SavePostContentResult =
  | { ok: true; post: SavedPost }
  | { ok: false; error: string };

/**
 * Persist the Generate editor's text to the post via `PATCH /api/posts/[id]`.
 * Resolves with the server's saved row only when the write succeeded; never
 * throws, so callers can keep the user's local edit on failure.
 */
export async function savePostContent(args: {
  postId: string;
  content: string;
  saved: PostTextFields;
  fetchImpl?: typeof fetch;
}): Promise<SavePostContentResult> {
  const { postId, content, saved, fetchImpl = fetch } = args;
  try {
    const res = await fetchImpl(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPostContentPatch(content, saved)),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { post?: SavedPost };
      error?: { message?: string };
    } | null;
    if (!res.ok || !json?.ok || !json.data?.post) {
      return { ok: false, error: json?.error?.message ?? `Save failed (${res.status})` };
    }
    return { ok: true, post: json.data.post };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}
