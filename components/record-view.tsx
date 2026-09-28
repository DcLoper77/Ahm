"use client";

import Link from "next/link";
import {
  formatBytes,
  formatDate,
  getPath,
  humanize,
  isSensitiveKey,
  safeScalar,
} from "@/lib/admin/format";
import { Badge, Card, DetailRows, StatusBadge } from "./ui";
import { Icon } from "./icons";
import type { AdminRecord } from "@/lib/admin/types";

export function RecordFacts({
  record,
  fields,
}: {
  record: AdminRecord;
  fields: { key: string; label: string; kind?: "date" | "bytes" | "status" | "id" }[];
}) {
  return (
    <DetailRows
      rows={fields.map(({ key, label, kind }) => {
        const value = getPath(record, key);
        const scalar = safeScalar(value);
        let display: React.ReactNode =
          scalar ??
          (Array.isArray(value)
            ? `${value.length} items`
            : value === null
              ? "Not reported"
              : "Available");
        if (kind === "date") display = formatDate(value);
        if (kind === "bytes") display = formatBytes(value);
        if (kind === "status") display = <StatusBadge value={value} />;
        if (kind === "id" && typeof value === "string") display = <code>{value}</code>;
        return { label, value: display, emphasis: kind === "status" };
      })}
    />
  );
}

export function SafeRecordSummary({
  record,
  exclude = [],
}: {
  record: AdminRecord;
  exclude?: string[];
}) {
  const rows = Object.entries(record)
    .filter(
      ([key, value]) =>
        !exclude.includes(key) && !isSensitiveKey(key) && safeScalar(value) !== null,
    )
    .slice(0, 12);
  return (
    <Card>
      <div className="card-heading">
        <div>
          <h2>Safe projection</h2>
          <p>Only scalar fields explicitly returned by the admin projection are shown.</p>
        </div>
      </div>
      {rows.length ? (
        <DetailRows
          rows={rows.map(([key, value]) => ({
            label: humanize(key),
            value:
              typeof key === "string" && /_at$/.test(key)
                ? formatDate(value)
                : key.toLowerCase().includes("bytes")
                  ? formatBytes(value)
                  : String(value),
          }))}
        />
      ) : (
        <div className="detail-section">
          <p className="page-description">No safe scalar fields were reported.</p>
        </div>
      )}
    </Card>
  );
}

export function ResourceLink({ href, label, id }: { href: string; label: string; id?: string }) {
  return (
    <Link href={href} className="resource-link">
      <span>{label}</span>
      {id ? <code>{id}</code> : null}
      <Icon name="chevron-right" size={14} />
    </Link>
  );
}

export function AuditRef({ requestId, auditId }: { requestId?: unknown; auditId?: unknown }) {
  if (typeof requestId !== "string" && typeof auditId !== "string")
    return <Badge tone="neutral">Audit reference pending</Badge>;
  return (
    <span className="audit-ref">
      <Badge tone="info" icon="shield">
        Audited
      </Badge>
      {typeof requestId === "string" ? <code>{requestId}</code> : null}
      {typeof auditId === "string" ? <code>{auditId}</code> : null}
    </span>
  );
}
