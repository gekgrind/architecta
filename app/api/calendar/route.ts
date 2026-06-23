import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarItemInputSchema } from "@/lib/validation/calendar";

export const runtime = "nodejs";

type CalendarRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  post_id: string | null;
  campaign_id: string | null;
  scheduled_for: string;
  platform: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function toCamel(row: CalendarRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    postId: row.post_id,
    campaignId: row.campaign_id,
    scheduledFor: row.scheduled_for,
    platform: row.platform,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  let query = supabase
    .from("architecta_content_calendar_items")
    .select("*")
    .eq("user_id", session.user.id)
    .order("scheduled_for", { ascending: true })
    .limit(500);

  if (from) query = query.gte("scheduled_for", from);
  if (to) query = query.lte("scheduled_for", to);
  if (platform) query = query.eq("platform", platform);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return apiError("server_error", error.message);

  return apiOk({
    items: (data ?? []).map((row) => toCamel(row as CalendarRow)),
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = calendarItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Invalid calendar payload", {
      details: { issues: parsed.error.flatten() },
    });
  }
  const input = parsed.data;

  const insertRow = {
    user_id: session.user.id,
    workspace_id: input.workspaceId ?? null,
    post_id: input.postId ?? null,
    campaign_id: input.campaignId ?? null,
    scheduled_for: input.scheduledFor,
    platform: input.platform,
    status: input.status,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("architecta_content_calendar_items")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return apiError("server_error", error.message);

  if (input.postId) {
    await supabase
      .from("architecta_posts")
      .update({
        status: "scheduled",
        scheduled_for: input.scheduledFor,
      })
      .eq("user_id", session.user.id)
      .eq("id", input.postId);
  }

  return apiOk({ item: toCamel(data as CalendarRow) });
}
