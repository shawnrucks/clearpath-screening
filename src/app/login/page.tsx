"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
const roles = [
  "Administrator",
  "Operations Specialist",
  "QA Reviewer",
  "Client Administrator",
  "Candidate",
  "Researcher / Vendor",
  "Billing Specialist",
  "Compliance Reviewer",
];
const roleEmails: Record<string, string> = {
  Administrator: "admin@clearpath.local",
  "Operations Specialist": "operations@clearpath.local",
  "QA Reviewer": "qa@clearpath.local",
  "Client Administrator": "client.admin@clearpath.local",
  Candidate: "candidate@clearpath.local",
  "Researcher / Vendor": "researcher@clearpath.local",
  "Billing Specialist": "billing@clearpath.local",
  "Compliance Reviewer": "compliance@clearpath.local",
};
export default function Login() {
  const r = useRouter(),
    [email, setEmail] = useState("operations@clearpath.local"),
    [password, setPassword] = useState("demo123"),
    [role, setRole] = useState("Operations Specialist"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/clearpath/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      if (res.ok)
        r.push(
          role === "Client Administrator"
            ? "/client/dashboard"
            : role === "Candidate"
              ? "/candidate/dashboard"
              : "/app/dashboard",
        );
      else setError("Email, password, and role did not match a demo account.");
    } catch {
      setError("The demo could not be reached. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-shell">
      <section
        className="login-left"
        aria-label="ClearPath operations overview"
      >
        <Link
          href="/"
          className="brand inverse"
          aria-label="ClearPath Screening home"
        >
          <span className="brand-mark">CP</span>
          <span>ClearPath Screening</span>
        </Link>
        <div>
          <p className="kicker blue">SECURE OPERATIONS ENVIRONMENT</p>
          <h1>
            ClearPath Screening
            <br />
            Operations Portal
          </h1>
          <p className="login-sub">
            Criminal Research · Verification · Quality Review · Compliance ·
            Client Operations
          </p>
          <p>
            Secure access to screening orders, research queues, verification
            requests, quality review, vendor follow-up, billing exceptions,
            client actions, and operational reporting.
          </p>
        </div>
        <div className="snapshot">
          <h3>
            Seeded queue snapshot <span>LIVE DEMO</span>
          </h3>
          <div>
            {[
              ["1,248", "Open screening items"],
              ["186", "Aging beyond SLA"],
              ["73", "Researcher follow-ups due"],
              ["41", "Reports in quality review"],
              ["29", "Client exceptions"],
              ["14", "Billing discrepancies"],
            ].map((x) => (
              <div key={x[1]}>
                <b>{x[0]}</b>
                <small>{x[1]}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="ops-areas">
          {[
            "New Order Review",
            "Candidate Missing Information",
            "Unassigned Searches",
            "Criminal Research",
            "Employment Verification",
            "Education Verification",
            "Quality Review",
            "Vendor Follow-Up",
            "Billing Reconciliation",
            "Executive Reporting",
          ].map((x) => (
            <span key={x}>✓ {x}</span>
          ))}
        </div>
      </section>
      <section className="login-right">
        <form onSubmit={submit} className="login-card" aria-busy={loading}>
          <p className="kicker">AUTHORIZED ACCESS ONLY</p>
          <h2>Sign in to ClearPath</h2>
          <p>
            Use the prefilled demo credentials to explore the operations portal.
          </p>
          <label htmlFor="email">
            Email address
            <input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
            />
          </label>
          <label htmlFor="password">
            Password
            <div className="password-field">
              <input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label htmlFor="role">
            Demo role
            <select
              id="role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setEmail(roleEmails[e.target.value]);
              }}
            >
              {roles.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn primary wide" disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
          <div className="demo-note">
            <b>Demo environment</b>
            <span>
              Uses seeded sample data only. No real candidate or consumer data.
            </span>
          </div>
        </form>
        <small>
          © 2026 ClearPath Screening · <Link href="/">Return home</Link>
        </small>
      </section>
    </main>
  );
}
