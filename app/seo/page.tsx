"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SeoPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "SEO Tools" }]}>
      <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Search className="h-5 w-5 text-blueprint-cyan" />
            SEO tools
          </CardTitle>
          <CardDescription>
            Keyword, page, and search-intent workflows will connect here as
            Architecta expands its web intelligence system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            For launch preparation, use the content studio and analytics
            snapshot to shape search-aware topics, then return here when the
            dedicated SEO workflow is enabled.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/generate">
                Generate search-aware content
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/analytics">View analytics</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
