import { apiError, apiOk } from "@/lib/api/response";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import {
  findDueWebsiteAnalysisJobs,
  processWebsiteAnalysisJob,
  sweepStaleWebsiteAnalysisJobs,
  type ProcessOutcome,
} from "@/lib/onboarding/website-analysis-jobs";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 300;

// Deliberately small: each job is one model attempt of up to 90s, run one at a
// time so NVIDIA's shared capacity isn't hammered and the run fits the window.
const BATCH = 2;

/**
 * Durable backstop for background website analysis: recovers stale claims and
 * runs due retries. Only processes jobs that already exist (created by an
 * authenticated, SSRF-checked onboarding request) — it never fetches URLs.
 */
export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return apiError("unauthorized", "Unauthorized");
  }

  try {
    const supabase = await createSupabaseServiceClient();
    const stale = await sweepStaleWebsiteAnalysisJobs(supabase);
    const due = await findDueWebsiteAnalysisJobs(supabase, BATCH);

    const outcomes: Record<ProcessOutcome, number> = {
      completed: 0,
      retry_scheduled: 0,
      failed: 0,
      skipped: 0,
      superseded: 0,
    };
    let errors = 0;

    for (const jobId of due) {
      try {
        outcomes[await processWebsiteAnalysisJob(jobId, { supabase })] += 1;
      } catch (err) {
        errors += 1;
        console.error("[cron:website-analysis] job failed", {
          jobId,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    // Aggregate counts only: no URLs, evidence, results or user ids.
    return apiOk({ scanned: due.length, ...outcomes, errors, stale });
  } catch (err) {
    console.error("[cron:website-analysis] run failed", err instanceof Error ? err.message : err);
    return apiError("server_error", "Website analysis processing failed");
  }
}
