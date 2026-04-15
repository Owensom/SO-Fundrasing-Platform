import crypto from "crypto";
import type { ApiRequest, ApiResponse } from "./http";

const COOKIE_NAME = "so_admin_session";

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }
  return secret;
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");
}

function makeToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      ts: Date.now(),
    }),
  ).toString("base64url");

  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyToken(token: string): { email: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (signature !== expected) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: string };

    if (!decoded.email) return null;

    return { email: decoded.email };
  } catch {
    return null;
  }
}

function parseCookies(req: ApiRequest): Record<string, string> {
  const raw = req.headers?.cookie ?? "";
  if (!raw) return {};

  return raw.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export function getAuthenticatedAdmin(
  req: ApiRequest,
): { email: string } | null {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  return verifyToken(token);
}

export function requireAdmin(req: ApiRequest): { email: string } {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    throw new Error("Unauthorized");
  }
  return admin;
}

export function isValidAdminLogin(email: string, password: string): boolean {
  return (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  );
}

export function setAdminSession(res: ApiResponse, email: string): void {
  const token = makeToken(email);

  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "Max-Age=604800",
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Set-Cookie", cookie);
}

export function clearAdminSession(res: ApiResponse): void {
  const cookie = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Set-Cookie", cookie);
}
