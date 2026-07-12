import {createHmac, timingSafeEqual} from "node:crypto";
import type {NextRequest, NextResponse} from "next/server";

export const SESSION_COOKIE = "cp_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 8;

export type Session = {
  email: string;
  name: string;
  role: string;
  expiresAt: number;
};

function secret() {
  const configured = process.env.CLEARPATH_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CLEARPATH_SESSION_SECRET must be configured in production");
  }
  return "clearpath-local-development-secret-change-me";
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(user: {email: string; name: string; role: string}) {
  const session: Session = {
    ...user,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
  };
  const payload = encode(JSON.stringify(session));
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = JSON.parse(decode(payload)) as Partial<Session>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function sessionFromRequest(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function hasRole(session: Session | null, allowedRoles: readonly string[]) {
  return Boolean(session && allowedRoles.includes(session.role));
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export const INTERNAL_ROLES = [
  "Administrator",
  "Operations Specialist",
  "QA Reviewer",
  "Researcher / Vendor",
  "Billing Specialist",
  "Compliance Reviewer",
] as const;
