"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hasAnyPermission, roleSummary } from "@/lib/admin/rbac";
import { NAV_SECTIONS, type NavItem } from "@/lib/admin/navigation";
import { useAdminSession } from "../auth/session-context";
import { StepUpDialog } from "../auth/step-up-dialog";
import { Icon } from "../icons";
import { Button, IconButton, InlineAlert } from "../ui";

function currentNavItem(pathname: string): NavItem | undefined {
  const visibleItems = NAV_SECTIONS.flatMap((section) => section.items);
  return visibleItems
    .filter((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { admin } = useAdminSession();
  const [search, setSearch] = useState("");
  const items = useMemo(
    () =>
      NAV_SECTIONS.flatMap((section) =>
        section.items.map((item) => ({ ...item, section: section.label })),
      ).filter((item) => hasAnyPermission(admin?.roles ?? [], item.permissions)),
    [admin?.roles],
  );
  const filtered = items
    .filter((item) =>
      `${item.label} ${item.description} ${item.section}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 8);
  return (
    <div
      className="modal-backdrop command-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="command-search">
          <Icon name="search" size={19} />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pages and resources"
            aria-label="Search pages and resources"
          />
          <kbd>esc</kbd>
        </div>
        <div className="command-results">
          {filtered.length ? (
            filtered.map((item) => (
              <button
                key={item.href}
                className="command-result"
                onClick={() => {
                  onClose();
                  router.push(item.href);
                }}
              >
                <span className="command-result-icon">
                  <Icon name={item.icon} size={18} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <Icon name="arrow-right" size={16} />
              </button>
            ))
          ) : (
            <div className="command-empty">No matching pages</div>
          )}
        </div>
        <div className="command-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
        </div>
      </div>
    </div>
  );
}

function ShellLoading() {
  return (
    <div className="shell-loading">
      <div className="shell-loading-mark">H</div>
      <div className="shell-loading-line" />
      <div className="shell-loading-line shell-loading-line-short" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, admin, signOut, notice, dismissNotice } = useAdminSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const active = currentNavItem(pathname);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (
      status === "unauthenticated" &&
      !admin &&
      pathname !== "/login" &&
      !pathname.startsWith("/invite")
    ) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [admin, pathname, router, status]);

  if (status === "loading") return <ShellLoading />;
  if (status === "unauthenticated" || !admin) {
    return <ShellLoading />;
  }

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasAnyPermission(admin.roles, item.permissions)),
  })).filter((section) => section.items.length);

  return (
    <div className="app-shell">
      <div
        className={`mobile-scrim ${mobileOpen ? "is-open" : ""}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark">H</span>
          <span className="brand-wordmark">
            havenerr<span>.</span>
          </span>
          <IconButton
            label="Close navigation"
            icon="x"
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
          />
        </div>
        <div className="environment-pill">
          <span className="status-dot status-dot-green" /> <span>Production</span>
          <span className="environment-api">API</span>
        </div>
        <nav className="nav-sections">
          {visibleSections.map((section) => (
            <div className="nav-section" key={section.label}>
              <p className="nav-section-label">{section.label}</p>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`nav-link ${active?.href === item.href ? "is-active" : ""}`}
                  aria-current={active?.href === item.href ? "page" : undefined}
                  title={item.description}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="security-status">
            <span className="status-dot status-dot-blue" />
            <span>
              <strong>Session protected</strong>
              <small>HttpOnly · MFA aware</small>
            </span>
          </div>
          <Link href="/settings/sessions" className="sidebar-settings">
            <Icon name="lock" size={16} /> Security settings
          </Link>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton
              label="Open navigation"
              icon="menu"
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
            />
            <button className="command-trigger" onClick={() => setPaletteOpen(true)}>
              <Icon name="search" size={17} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
          </div>
          <div className="topbar-right">
            <div className="topbar-health">
              <span className="status-dot status-dot-green" />
              <span>Operational</span>
            </div>
            <div className="topbar-divider" />
            <div className="identity-menu">
              <span className="identity-avatar">{admin.email.charAt(0).toUpperCase()}</span>
              <span className="identity-copy">
                <strong>{admin.email}</strong>
                <small>{roleSummary(admin.roles)}</small>
              </span>
              <Icon name="chevron-down" size={14} />
            </div>
            <Button
              variant="quiet"
              icon="logout"
              className="logout-button"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </header>
        <main className="content-canvas">
          <div className="breadcrumb">
            <span>Control panel</span>
            {active && active.href !== "/" ? (
              <>
                <Icon name="chevron-right" size={13} />
                <span>{active.label}</span>
              </>
            ) : null}
          </div>
          {notice ? (
            <InlineAlert
              tone={
                notice.kind === "success"
                  ? "success"
                  : notice.kind === "warning"
                    ? "warning"
                    : "info"
              }
              title={notice.title}
              onDismiss={dismissNotice}
            >
              {notice.message}
              {notice.requestId ? (
                <span className="notice-request">Request {notice.requestId}</span>
              ) : null}
            </InlineAlert>
          ) : null}
          {children}
        </main>
      </div>
      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
      <StepUpDialog />
    </div>
  );
}
