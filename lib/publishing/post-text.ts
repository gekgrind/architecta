/**
 * Client-safe mapping between a post's persisted content fields and the single
 * block of text the user edits in Generate (and that social publishing sends).
 *
 * The editor shows `composePostText(post)`; publishing sends the same text
 * (see `buildPostText` in ./publish). Saving an edit maps the text back onto
 * the same fields with `toPostContentPatch`, which guarantees
 * `composePostText(patched)` equals the edited text — so what the user saved is
 * exactly what gets published.
 */

export type PostTextFields = {
  hook: string | null;
  caption: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string[] | null;
};

/** Content fields sent to `PATCH /api/posts/[id]` (strings, never null — see postPatchSchema). */
export type PostContentPatch = {
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  body?: string;
};

export function formatHashtags(hashtags: string[] | null | undefined): string {
  if (!hashtags?.length) return "";
  return hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
}

/** hook · caption (or body) · cta · hashtags, separated by blank lines. */
export function composePostText(post: PostTextFields): string {
  const segments: string[] = [];
  if (post.hook) segments.push(post.hook);
  const main = post.caption || post.body;
  if (main) segments.push(main);
  if (post.cta) segments.push(post.cta);
  const tags = formatHashtags(post.hashtags);
  if (tags) segments.push(tags);
  return segments.filter(Boolean).join("\n\n");
}

/**
 * Map edited editor text back onto the post's content fields.
 *
 * The hook, CTA and hashtag line are kept as structured fields only when the
 * user left them untouched at the start/end of the text; anything else is the
 * main copy (`caption`). If that split cannot reproduce the edited text
 * exactly, the whole text becomes the caption and the other segments are
 * cleared. `body` is updated only when it mirrors the caption (or is what the
 * editor was showing), so a separate long-form expansion is not overwritten.
 */
export function toPostContentPatch(edited: string, saved: PostTextFields): PostContentPatch {
  const text = edited.trim();
  let rest = text;
  let hook = "";
  let cta = "";
  let hashtags: string[] = [];

  if (saved.hook && rest.startsWith(`${saved.hook}\n\n`)) {
    hook = saved.hook;
    rest = rest.slice(hook.length + 2);
  }
  const tagLine = formatHashtags(saved.hashtags);
  if (tagLine && rest.endsWith(`\n\n${tagLine}`)) {
    hashtags = [...(saved.hashtags ?? [])];
    rest = rest.slice(0, rest.length - tagLine.length - 2);
  }
  if (saved.cta && rest.endsWith(`\n\n${saved.cta}`)) {
    cta = saved.cta;
    rest = rest.slice(0, rest.length - saved.cta.length - 2);
  }

  let patch: PostContentPatch = { hook, caption: rest, cta, hashtags };
  if (!rest || composePostText({ ...patch, body: null }) !== text) {
    patch = { hook: "", caption: text, cta: "", hashtags: [] };
  }

  const editorShowedBody = !saved.caption;
  const bodyMirrorsCaption = !saved.body || saved.body === saved.caption;
  if (editorShowedBody || bodyMirrorsCaption) patch.body = patch.caption;

  return patch;
}
