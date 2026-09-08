"use client";

import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "danger-quiet";

export function Button({
  children,
  variant = "secondary",
  icon,
  loading = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button button-${variant} ${className}`}
      disabled={loading || props.disabled}
    >
      {loading ? (
        <span className="button-spinner" aria-hidden="true" />
      ) : icon ? (
        <Icon name={icon} size={16} />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  icon,
  className = "",
  ...props
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: IconName;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={`button button-${variant} ${className}`} {...props}>
      {icon ? <Icon name={icon} size={16} /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function IconButton({
  label,
  icon,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Card({
  children,
  className = "",
  as: Element = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Element className={`card ${className}`}>{children}</Element>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  icon?: IconName;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ value, label }: { value: unknown; label?: string }) {
  const text = label ?? (typeof value === "string" ? value.replaceAll("_", " ") : "Unknown");
  const normalized = String(value ?? "").toUpperCase();
  const tone =
    normalized.includes("FAIL") ||
    normalized.includes("ERROR") ||
    normalized.includes("DEAD") ||
    normalized.includes("SUSPENDED") ||
    normalized === "DENIED"
      ? "danger"
      : normalized.includes("PENDING") ||
          normalized.includes("RUNNING") ||
          normalized.includes("PROVISION") ||
          normalized.includes("OUT_OF_SYNC") ||
          normalized.includes("GRACE") ||
          normalized.includes("PAST_DUE")
        ? "warning"
        : normalized.includes("SUCCESS") ||
            normalized.includes("ACTIVE") ||
            normalized.includes("LIVE") ||
            normalized.includes("IN_SYNC") ||
            normalized.includes("VERIFIED") ||
            normalized === "SUCCEEDED"
          ? "success"
          : "neutral";
  return <Badge tone={tone}>{text}</Badge>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function InlineAlert({
  tone = "info",
  title,
  children,
  onDismiss,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`inline-alert inline-alert-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon
        name={tone === "success" ? "check-circle" : tone === "info" ? "info" : "alert"}
        size={18}
      />
      <div className="inline-alert-copy">
        {title ? <strong>{title}</strong> : null}
        <span>{children}</span>
      </div>
      {onDismiss ? <IconButton label="Dismiss" icon="x" onClick={onDismiss} /> : null}
    </div>
  );
}

export function EmptyState({
  icon = "spark",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-state" aria-live="polite">
      <span className="loading-spinner" />
      {label}
    </div>
  );
}

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  caption: string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div
      className="table-wrap"
      role="region"
      aria-label={`${caption} table. Use horizontal scrolling on narrow screens.`}
      tabIndex={0}
    >
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`${column.align === "right" ? "align-right" : ""} ${column.className ?? ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "is-clickable" : ""}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`${column.align === "right" ? "align-right" : ""} ${column.className ?? ""}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CursorPagination({
  hasNext,
  canBack,
  onNext,
  onBack,
  label = "records",
}: {
  hasNext: boolean;
  canBack: boolean;
  onNext: () => void;
  onBack: () => void;
  label?: string;
}) {
  return (
    <div className="pagination">
      <span className="pagination-label">Showing current page of {label}</span>
      <div className="pagination-actions">
        <Button variant="quiet" icon="chevron-left" onClick={onBack} disabled={!canBack}>
          Previous
        </Button>
        <Button variant="quiet" onClick={onNext} disabled={!hasNext}>
          Next <Icon name="chevron-right" size={15} />
        </Button>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  staticContent = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  staticContent?: boolean;
}) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const control =
    isValidElement(children) && !(children.props as { id?: unknown }).id
      ? cloneElement(children as React.ReactElement<{ id?: string }>, { id: controlId })
      : children;
  return (
    <div className="field">
      {staticContent ? (
        <span className="field-label">{label}</span>
      ) : (
        <label htmlFor={controlId}>{label}</label>
      )}
      {control}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="text-input" {...props} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="text-input select-input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="text-input text-area" {...props} />;
}

export function Modal({
  title,
  description,
  children,
  onClose,
  size = "medium",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "small" | "medium" | "large";
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocused = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const focusOrigin = previouslyFocused.current;
    const dialog = dialogRef.current;
    const focusableSelector =
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
    const focusFirst = () => {
      const first = dialog?.querySelector<HTMLElement>(
        `${focusableSelector}[autofocus], ${focusableSelector}`,
      );
      first?.focus();
    };
    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      focusOrigin?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal modal-${size}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton label="Close dialog" icon="x" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "blue",
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: IconName;
  tone?: "blue" | "green" | "amber" | "red";
  href?: string;
}) {
  const content = (
    <>
      <div className={`stat-icon stat-icon-${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="stat-copy">
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        {detail ? <span className="stat-detail">{detail}</span> : null}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="stat-card">
      {content}
      <Icon name="arrow-right" className="stat-arrow" size={16} />
    </Link>
  ) : (
    <div className="stat-card">{content}</div>
  );
}

export function DetailRows({
  rows,
}: {
  rows: { label: string; value: ReactNode; emphasis?: boolean }[];
}) {
  return (
    <dl className="detail-rows">
      {rows.map((row) => (
        <div key={row.label} className="detail-row">
          <dt>{row.label}</dt>
          <dd className={row.emphasis ? "emphasis" : ""}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ModalForm({
  onSubmit,
  children,
  actions,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="modal-body">{children}</div>
      <div className="modal-footer">{actions}</div>
    </form>
  );
}

export function CopyValue({ value, label = "Copy value" }: { value: string; label?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* Clipboard permission is optional. */
    }
  };
  return (
    <span className="copy-value">
      <code>{value}</code>
      <IconButton label={label} icon="copy" onClick={copy} type="button" />
    </span>
  );
}

export function NoticeStack({
  notices,
  onDismiss,
}: {
  notices: {
    id: string;
    tone: "info" | "warning" | "danger" | "success";
    title: string;
    message: string;
  }[];
  onDismiss: (id: string) => void;
}) {
  return notices.length ? (
    <div className="notice-stack">
      {notices.map((notice) => (
        <InlineAlert
          key={notice.id}
          tone={notice.tone}
          title={notice.title}
          onDismiss={() => onDismiss(notice.id)}
        >
          {notice.message}
        </InlineAlert>
      ))}
    </div>
  ) : null;
}
