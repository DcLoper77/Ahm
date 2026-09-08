import type { SVGProps } from "react";

export type IconName =
  | "spark"
  | "users"
  | "building"
  | "layers"
  | "sliders"
  | "server"
  | "globe"
  | "database"
  | "cpu"
  | "credit-card"
  | "receipt"
  | "arrow-up-right"
  | "shield"
  | "activity"
  | "pulse"
  | "lock"
  | "search"
  | "menu"
  | "x"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "arrow-right"
  | "refresh"
  | "more"
  | "plus"
  | "check"
  | "copy"
  | "external"
  | "alert"
  | "clock"
  | "download"
  | "logout"
  | "key"
  | "filter"
  | "sort"
  | "eye"
  | "eye-off"
  | "command"
  | "trash"
  | "pause"
  | "play"
  | "rotate"
  | "edit"
  | "calendar"
  | "check-circle"
  | "info";

const paths: Record<IconName, React.ReactNode> = {
  spark: (
    <path d="m12 2 1.45 6.55L20 10l-6.55 1.45L12 18l-1.45-6.55L4 10l6.55-1.45L12 2Zm6.4 13.2.65 2.75 2.75.65-2.75.65-.65 2.75-.65-2.75-2.75-.65 2.75-.65.65-2.75Z" />
  ),
  users: (
    <>
      <path d="M16 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 19.5V21" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 3.2a4 4 0 0 1 0 7.6M22 21v-1.5a4.5 4.5 0 0 0-3.3-4.34" />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M5 21V5.5L12 3l7 2.5V21M9 21v-4h6v4M8 8h1m6 0h1m-8 4h1m6 0h1" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
      <circle cx="10" cy="18" r="2" fill="currentColor" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="3" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="7" rx="2" />
      <path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.3 2.45 3.4 5.45 3.4 9S14.3 18.55 12 21c-2.3-2.45-3.4-5.45-3.4-9S9.7 5.45 12 3Z" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 1v3m6-3v3m-6 16v3m6-3v3M1 9h3m-3 6h3m16-6h3m-3 6h3M9 10h6v4H9z" />
    </>
  ),
  "credit-card": (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 17 17 7M8 7h9v9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v5c0 5-3.4 8.45-8 10-4.6-1.55-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.25 2.25L15.8 9.2" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2.2-6 4.1 12 2.1-6H21" />
    </>
  ),
  pulse: (
    <>
      <path d="M3 12h3l2-5 4 10 2-5h7" />
      <circle cx="12" cy="12" r="9" opacity=".18" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "arrow-right": (
    <>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.7-4L3 10M4 4v6h6M4 13a8 8 0 0 0 14.7 4L21 14m-1 6v-6h-6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  copy: (
    <>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 20h16" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17 15 12 10 7M15 12H3" />
      <path d="M21 19V5a2 2 0 0 0-2-2h-5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8m-2 0 2 2m-5 1 2 2" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16M7 12h10m-6 7h2" />
    </>
  ),
  sort: (
    <>
      <path d="M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  "eye-off": (
    <>
      <path d="m3 3 18 18M10.6 10.7a2.5 2.5 0 0 0 3.7 3.7M9.9 5.8A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.1 3.7M6.5 6.8C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.5-.8" />
    </>
  ),
  command: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 9h6v6H9zM9 4v5m6-5v5m0 6v6m-6-6v6M4 9h5m6 0h5m-5 6h5m-11 0H4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m-9 0 1 14h10l1-14" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" />,
  rotate: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4L3 10m0 0h6M4 13a8 8 0 0 0 14 4l3-3m0 0h-6" />
    </>
  ),
  edit: (
    <>
      <path d="m4 16-.8 4.8L8 20l11-11a2.8 2.8 0 0 0-4-4L4 16Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  ...props
}: { name: IconName; size?: number; strokeWidth?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "name"
>) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
