"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContentTypeIcon } from "@/components/ui/content-type-icon";

import { mockContentItems } from "@/lib/mock-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  Sparkles,
  FileText,
  TrendingUp,
  Calendar,
  ArrowRight,
} from "lucide-react";

import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [userName, setUserName] = useState<string>("there");
  const [loading, setLoading] = useState(true);

  const recentContent = mockContentItems.slice(0, 4);

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/auth/login");
        return;
      }

      const user = data.user;

      // Prefer name from OAuth metadata, fallback to email
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "there";

      setUserName(name);
      setLoading(false);
    }

    loadUser();
  }, [router, supabase]);

  // Prevent UI flash before auth resolves
  if (loading) {
    return null;
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {userName}
            </h1>
            <p className="text-muted-foreground">
              Here&apos;s what&apos;s happening with your content
            </p>
          </div>

          <Link href="/generate">
            <Button className="bg-primary hover:bg-primary/90 gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Content
            </Button>
          </Link>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Content"
            value="47"
            trend={{ value: 12, direction: "up" }}
          />
          <MetricCard
            label="Published"
            value="32"
            trend={{ value: 8, direction: "up" }}
          />
          <MetricCard
            label="Engagement Rate"
            value="4.2%"
            trend={{ value: 0.5, direction: "up" }}
          />
          <MetricCard
            label="Content Score"
            value="86"
            trend={{ value: 3, direction: "up" }}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/generate">
            <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    Generate Content
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Create new AI-powered content
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/brand-kit">
            <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-secondary/10 p-3">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Brand Kit</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your brand voice
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/library">
            <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-accent/10 p-3">
                  <TrendingUp className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    View Library
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Browse all your content 2
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Content */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Content</CardTitle>
            <Link href="/library">
              <Button variant="ghost" size="sm" className="text-primary">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {recentContent.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <ContentTypeIcon type={item.contentType} size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {item.title}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.content.slice(0, 60)}...
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
