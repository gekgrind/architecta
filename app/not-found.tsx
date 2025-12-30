import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-gradient-glow opacity-30" />

      <div className="relative z-10 px-6 text-center">
        <div className="mb-6 font-display text-8xl font-bold text-gradient md:text-9xl">
          404
        </div>

        <h1 className="mb-4 font-display text-3xl font-medium text-foreground md:text-4xl">
          Page not found
        </h1>

        <p className="mx-auto mb-8 max-w-md text-lg text-muted-foreground">
          The page you’re looking for doesn’t exist or has been moved.
        </p>

        <Button variant="default" size="lg" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
