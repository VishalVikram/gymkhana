"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { createLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const logger = createLogger("app");

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // After a redeploy, an old page can request JS chunks that no longer exist.
  // A full reload fetches the new build; auto-reload once per tab to avoid loops.
  const isChunkError =
    error?.name === "ChunkLoadError" || /Loading chunk|Failed to load chunk/i.test(error?.message ?? "");

  useEffect(() => {
    logger.error("App error:", error as Error);
    if (!isChunkError) return;
    try {
      if (sessionStorage.getItem("chunk-reloaded") !== "1") {
        sessionStorage.setItem("chunk-reloaded", "1");
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [error, isChunkError]);

  const handleRetry = () => {
    if (isChunkError) {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-destructive/10 rounded-full p-6">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold">
            Oops! Something went wrong
          </CardTitle>
          <CardDescription>
            We encountered an unexpected error. Don&apos;t worry, your data is safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(error instanceof Error ? error.message : String(error)) && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-mono break-words">
                {error instanceof Error ? error.message : String(error)}
              </p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="destructive"
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            
            <Button
              variant="outline"
              asChild
            >
              <Link href="/dashboard" className="gap-2">
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          </div>
          
          {error.digest && (
            <p className="text-xs text-muted-foreground text-center">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
