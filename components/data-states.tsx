"use client";

import { AdminApiError } from "@/lib/admin/errors";
import { Button, Card, EmptyState, InlineAlert, LoadingState } from "./ui";

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof AdminApiError ? error.message : "The admin service could not load this view.";
  const requestId = error instanceof AdminApiError ? error.requestId : undefined;
  return (
    <Card className="state-card">
      <InlineAlert tone="danger" title="Unable to load this view">
        {message}
        {requestId ? <span className="notice-request">Request {requestId}</span> : null}
      </InlineAlert>
      {onRetry ? (
        <Button variant="secondary" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Card>
  );
}

export function QueryLoading({ label }: { label?: string }) {
  return (
    <Card>
      <LoadingState label={label} />
    </Card>
  );
}

export function QueryEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <EmptyState title={title} description={description} action={action} />
    </Card>
  );
}
