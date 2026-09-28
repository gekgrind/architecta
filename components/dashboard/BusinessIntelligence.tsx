"use client";

import { ArrowRight, Fingerprint } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type {
  DashboardKnowledge,
  KnowledgeContext,
  KnowledgeField,
  KnowledgeSource,
} from "@/lib/dashboard/model";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<KnowledgeSource, string> = {
  brand_profile: "Brand profile",
  onboarding: "Onboarding",
  website_analysis: "Website analysis",
};

/** Long-form facts get a wider tile so each group fills its rows evenly. */
const WIDE = new Set<string>(["description", "differentiators", "pains"]);

/** Presentation-only grouping of what Architecta knows, for scanability. */
const GROUPS: Array<{
  title: string;
  fields: KnowledgeField["id"][];
  context: KnowledgeContext["id"][];
}> = [
  { title: "Business", fields: ["name", "description", "offers"], context: ["industry", "mission"] },
  { title: "Market", fields: ["audience", "competitors"], context: ["market", "pains", "outcome"] },
  { title: "Brand", fields: ["voice", "differentiators"], context: [] },
];

/** "What Architecta knows" — the business context every generation draws on. */
export function BusinessIntelligence({ knowledge }: { knowledge: DashboardKnowledge }) {
  return (
    <DashboardCard title="What Architecta Knows" icon={Fingerprint} className="lg:col-span-2">
      {knowledge.status === "error" ? (
        <p className="text-sm text-[#BCC0D8]">
          Your business profile couldn&apos;t be loaded right now. Refresh to try again.
        </p>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-[#BCC0D8]">
            <span className="font-bold text-white">
              {knowledge.knownCount} of {knowledge.totalCount}
            </span>{" "}
            business foundations captured. Strategies and drafts are generated from these.
          </p>

          {GROUPS.map((group) => {
            const fields = group.fields
              .map((id) => knowledge.fields.find((field) => field.id === id))
              .filter((field): field is KnowledgeField => Boolean(field));
            const context = group.context
              .map((id) => knowledge.context.find((item) => item.id === id))
              .filter((item): item is KnowledgeContext => Boolean(item));
            if (fields.length + context.length === 0) return null;

            return (
              <section key={group.title} aria-labelledby={`knows-${group.title.toLowerCase()}`}>
                <h3
                  id={`knows-${group.title.toLowerCase()}`}
                  className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-[#00D4FF]/80"
                >
                  {group.title}
                  <span className="h-px flex-1 bg-white/5" aria-hidden="true" />
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {fields.map((field) => (
                    <FieldTile key={field.id} field={field} />
                  ))}
                  {context.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-xl border border-white/5 bg-white/[0.03] p-4",
                        WIDE.has(item.id) && "xl:col-span-2"
                      )}
                    >
                      <dt className="mb-1 font-mono text-[10px] uppercase text-[#BCC0D8]">{item.label}</dt>
                      <dd className="line-clamp-3 text-sm leading-snug text-white/90">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}

function FieldTile({ field }: { field: KnowledgeField }) {
  return (
    <div
      className={cn(
        field.value
          ? "rounded-xl border border-white/5 bg-white/5 p-4"
          : "rounded-xl border border-dashed border-white/10 p-4",
        WIDE.has(field.id) && "xl:col-span-2"
      )}
    >
      <dt className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase text-[#BCC0D8]">
        <span>{field.label}</span>
        {field.source ? (
          <span className="truncate normal-case tracking-normal text-[#BCC0D8]/60">
            {SOURCE_LABEL[field.source]}
          </span>
        ) : null}
      </dt>
      <dd>
        {field.values.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {field.values.slice(0, 6).map((value) => (
              <li
                key={value}
                className="rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 px-2.5 py-0.5 text-xs text-white"
              >
                {value}
              </li>
            ))}
          </ul>
        ) : field.value ? (
          <p className="line-clamp-3 text-sm leading-snug text-white">{field.value}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm text-[#BCC0D8]/70">Not captured yet</span>
            {field.editHref ? (
              <Link
                href={field.editHref}
                className="inline-flex items-center gap-1 rounded text-xs text-[#00D4FF] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#00D4FF]/60"
              >
                Add <ArrowRight size={11} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        )}
      </dd>
    </div>
  );
}
