import "server-only";

/**
 * Robustly extract a JSON object from LLM text output. Handles fenced code
 * blocks (```json ... ```), leading/trailing prose, and trailing commas.
 */
export function extractJson<T = unknown>(text: string): T {
  const stripped = text.trim();

  // Try a fenced ```json block first.
  const fenceMatch = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return parseLoose<T>(fenceMatch[1]);
  }

  // Otherwise, find the outermost {...} or [...] span.
  const firstCurly = stripped.indexOf("{");
  const firstSquare = stripped.indexOf("[");
  const firstIdx =
    firstCurly === -1
      ? firstSquare
      : firstSquare === -1
      ? firstCurly
      : Math.min(firstCurly, firstSquare);

  if (firstIdx === -1) {
    throw new Error("No JSON object found in LLM output");
  }

  const opener = stripped[firstIdx];
  const closer = opener === "{" ? "}" : "]";
  const lastIdx = stripped.lastIndexOf(closer);
  if (lastIdx === -1 || lastIdx < firstIdx) {
    throw new Error("Unterminated JSON in LLM output");
  }

  return parseLoose<T>(stripped.slice(firstIdx, lastIdx + 1));
}

function parseLoose<T>(raw: string): T {
  const cleaned = raw
    .trim()
    // strip JS-style comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    // remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : "JSON parse failed";
    throw new Error(`Could not parse LLM JSON output: ${message}`);
  }
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function asSectionArray(
  value: unknown
): Array<{ title: string; items: string[] }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ title: string; items: string[] }> = [];
  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const e = entry as { title?: unknown; items?: unknown };
      const title = typeof e.title === "string" ? e.title : null;
      const items = asStringArray(e.items);
      if (title) {
        out.push({ title, items });
      }
    }
  }
  return out;
}
