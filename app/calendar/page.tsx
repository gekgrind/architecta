"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CalendarPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Calendar" }]}>
      <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="h-5 w-5 text-blueprint-cyan" />
            Calendar and planning
          </CardTitle>
          <CardDescription>
            Campaign scheduling and publishing plans will live here as the
            planning system matures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            For launch preparation, use Campaigns to organize the strategy and
            Generate to create the assets that will populate the calendar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/campaigns">
                Open campaigns
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/generate">Create content</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
