export function formatDate(value: unknown, options?: Intl.DateTimeFormatOptions): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(date);
}

export function formatRelative(value: unknown): string {
  if (typeof value !== "string" || !value) return "Unknown time";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown time";
  const delta = timestamp - Date.now();
  const minutes = Math.round(delta / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return `${Math.abs(minutes)}m ${minutes < 0 ? "ago" : "from now"}`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${Math.abs(hours)}h ${hours < 0 ? "ago" : "from now"}`;
  const days = Math.round(hours / 24);
  return `${Math.abs(days)}d ${days < 0 ? "ago" : "from now"}`;
}

export function formatMoneyMinor(value: unknown, currency: unknown): string {
  if (typeof value !== "number" || typeof currency !== "string") return "—";
  const normalized = currency.toUpperCase();
  if (normalized !== "INR" && normalized !== "USD") return "—";
  return new Intl.NumberFormat(normalized === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: normalized,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatBytes(value: unknown): string {
  const number =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) return "—";
  if (number < 1024) return `${number} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let amount = number;
  let unit = "B";
  for (const nextUnit of units) {
    amount /= 1024;
    unit = nextUnit;
    if (amount < 1024) break;
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${unit}`;
}

export function humanize(value: unknown): string {
  if (typeof value !== "string") return "—";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function safeScalar(value: unknown): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return null;
}

export function isSensitiveKey(key: string): boolean {
  return /(password|secret|token|credential|private|payload|authorization|connection_url|raw)/i.test(
    key,
  );
}

export function initials(value: string): string {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .padEnd(2, "•");
}
