"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Deliberately omit the error object: API payloads and sensitive admin state must not enter logs.
  }, []);
  return (
    <div className="route-fallback">
      <Card>
        <div className="empty-state">
          <div className="empty-icon">!</div>
          <h1>Something interrupted this view</h1>
          <p>
            The control panel kept the error boundary generic. Try the view again; request IDs
            remain visible on expected API failures.
          </p>
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
