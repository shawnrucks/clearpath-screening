"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
const nav = [
  "Dashboard",
  "Orders",
  "Work Queues",
  "Candidates",
  "Searches",
  "Quality Review",
  "Clients",
  "Vendors",
  "Billing",
  "Reports",
  "Audit Log",
  "Administration",
];
const paths: Record<string, string> = {
  Dashboard: "dashboard",
  Orders: "orders",
  "Work Queues": "queues",
  Candidates: "candidates",
  Searches: "searches",
  "Quality Review": "quality-review",
  Clients: "clients",
  Vendors: "vendors",
  Billing: "billing",
  Reports: "reports",
  "Audit Log": "audit-log",
  Administration: "admin",
};
const icons = ["▦", "▤", "☷", "♙", "⌕", "✓", "▣", "◇", "$", "▥", "↻", "⚙"];
export function Portal({
  children,
  user = { name: "Taylor Reed", role: "Operations Specialist" },
}: {
  children: React.ReactNode;
  user?: { name: string; role: string };
}) {
  const p = usePathname(),
    r = useRouter(),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(""),
    [helpOpen, setHelpOpen] = useState(false),
    [noticesOpen, setNoticesOpen] = useState(false),
    [userOpen, setUserOpen] = useState(false),
    [loggingOut, setLoggingOut] = useState(false),
    searchRef = useRef<HTMLInputElement>(null);
  const matches = nav
    .filter((x) => x.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setHelpOpen(false);
        setNoticesOpen(false);
        setUserOpen(false);
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 0);
  }, [searchOpen]);
  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/clearpath/logout", { method: "POST" });
    } finally {
      r.push("/login");
      r.refresh();
    }
  }
  return (
    <div className="portal">
      <aside>
        <Link
          href="/"
          className="brand inverse"
          aria-label="ClearPath Screening home"
        >
          <span className="brand-mark">CP</span>
          <span>
            ClearPath <b>Screening</b>
            <small>OPERATIONS PORTAL</small>
          </span>
        </Link>
        <nav aria-label="Operations navigation">
          {nav.map((x, i) => (
            <Link
              aria-current={p.includes(`/app/${paths[x]}`) ? "page" : undefined}
              className={p.includes(`/app/${paths[x]}`) ? "active" : ""}
              href={`/app/${paths[x]}`}
              key={x}
            >
              <span aria-hidden="true">{icons[i]}</span>
              {x}
              {x === "Work Queues" && (
                <b className="nav-count" aria-label="43 open items">
                  43
                </b>
              )}
            </Link>
          ))}
        </nav>
        <div className="system">
          <span className="pulse" aria-hidden="true"></span>
          <div>
            <b>All systems operational</b>
            <small>Demo environment</small>
          </div>
        </div>
        <div className="user-wrap">
          <button
            type="button"
            className="side-user"
            aria-expanded={userOpen}
            aria-haspopup="menu"
            onClick={() => setUserOpen((v) => !v)}
          >
            <span>
              {user.name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{user.role}</small>
            </div>
            <b aria-hidden="true">⋮</b>
          </button>
          {userOpen && (
            <div className="user-menu" role="menu">
              {user.role === "Administrator" ? (
                <Link
                  role="menuitem"
                  href="/app/admin"
                  onClick={() => setUserOpen(false)}
                >
                  Administration
                </Link>
              ) : (
                <span className="user-menu-summary">
                  Signed in as {user.role}
                </span>
              )}
              <button
                role="menuitem"
                type="button"
                onClick={logout}
                disabled={loggingOut}
              >
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="portal-main">
        <header>
          <button
            type="button"
            className="global-search"
            onClick={() => setSearchOpen(true)}
            aria-label="Search ClearPath"
          >
            <span aria-hidden="true">⌕</span>
            <span>Search orders, candidates, searches...</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="header-actions">
            <span className="date">Sunday, July 12, 2026</span>
            <button
              type="button"
              aria-label="Help and keyboard shortcuts"
              aria-expanded={helpOpen}
              onClick={() => {
                setHelpOpen((v) => !v);
                setNoticesOpen(false);
              }}
            >
              ?
            </button>
            <button
              type="button"
              aria-label="Notifications, 3 unread"
              aria-expanded={noticesOpen}
              onClick={() => {
                setNoticesOpen((v) => !v);
                setHelpOpen(false);
              }}
            >
              ♢<i>3</i>
            </button>
            {helpOpen && (
              <div className="header-popover help-popover">
                <b>ClearPath help</b>
                <p>
                  Use <kbd>⌘ K</kbd> to find a workspace. Demo actions are saved
                  to the audit log.
                </p>
                <Link href="/app/admin">View demo controls →</Link>
              </div>
            )}
            {noticesOpen && (
              <div className="header-popover notice-popover">
                <b>Notifications</b>
                <Link href="/app/queues/overdue-searches">
                  <span className="notice-dot red"></span>
                  <span>
                    <strong>2 overdue searches</strong>
                    <small>Require review today</small>
                  </span>
                </Link>
                <Link href="/app/quality-review">
                  <span className="notice-dot amber"></span>
                  <span>
                    <strong>QA queue updated</strong>
                    <small>10 reports ready</small>
                  </span>
                </Link>
                <Link href="/app/queues/billing-exceptions">
                  <span className="notice-dot blue"></span>
                  <span>
                    <strong>Billing exception assigned</strong>
                    <small>Meridian Community Bank</small>
                  </span>
                </Link>
              </div>
            )}
          </div>
        </header>
        {children}
      </main>
      {searchOpen && (
        <div
          className="command-bg"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <section
            className="command"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-title"
          >
            <h2 id="command-title">Search ClearPath</h2>
            <label className="command-input">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a workspace name…"
                aria-label="Search workspaces"
              />
              <kbd>ESC</kbd>
            </label>
            <div className="command-results">
              {matches.length ? (
                matches.map((x, i) => (
                  <Link
                    href={`/app/${paths[x]}`}
                    key={x}
                    onClick={() => setSearchOpen(false)}
                  >
                    <span aria-hidden="true">{icons[nav.indexOf(x)]}</span>
                    <b>{x}</b>
                    <small>Open workspace →</small>
                  </Link>
                ))
              ) : (
                <p>
                  No workspaces match “{query}”. Try Orders, Queues, or Reports.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function ActionModal({
  label = "Open",
  title,
  entity,
  fields = [],
}: {
  label?: string;
  title: string;
  entity: string;
  fields?: string[];
}) {
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [values, setValues] = useState<Record<string, string>>({}),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    id = `action-${entity.replace(/[^a-z0-9]/gi, "-")}`;
  useEffect(() => {
    if (!open) return;
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  function setField(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clearpath/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: title, entityId: entity, values, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Unable to save changes");
      setOpen(false);
      setValues({});
      setNote("");
      location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        className="table-action"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {label} →
      </button>
      {open && (
        <div
          className="modal-bg"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-entity`}
          >
            <div className="modal-head">
              <div>
                <p className="kicker">MANUAL OPERATION</p>
                <h2 id={`${id}-title`}>{title}</h2>
                <p id={`${id}-entity`}>{entity}</p>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            {fields.map((f, i) => (
              <label key={f}>
                {f}
                {f.includes("Status") ? (
                  <select
                    autoFocus={i === 0}
                    value={values[f] || ""}
                    onChange={(e) => setField(f, e.target.value)}
                  >
                    <option value="">Select status</option>
                    <option>In Progress</option>
                    <option>Awaiting Vendor</option>
                    <option>Quality Review</option>
                    <option>Completed</option>
                    <option>Resolved</option>
                    <option>Pending Review</option>
                    <option>Approved</option>
                  </select>
                ) : (
                  <input
                    autoFocus={i === 0}
                    value={values[f] || ""}
                    onChange={(e) => setField(f, e.target.value)}
                    type={
                      f.includes("Date")
                        ? "date"
                        : f.includes("Cost") || f.includes("Fee")
                          ? "number"
                          : "text"
                    }
                    min={
                      f.includes("Cost") || f.includes("Fee") ? "0" : undefined
                    }
                    step={
                      f.includes("Cost") || f.includes("Fee")
                        ? "0.01"
                        : undefined
                    }
                    placeholder={`Enter ${f.toLowerCase()}`}
                  />
                )}
              </label>
            ))}
            <label>
              Internal note
              <textarea
                autoFocus={fields.length === 0}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Document the action taken and relevant context"
              ></textarea>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
