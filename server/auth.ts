import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const HASH_SEPARATOR = ":";
const AUTH_COOKIE_NAME = "pagaline.auth";
const AUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser;
  }
}

function getAuthSecret() {
  return process.env.AUTH_COOKIE_SECRET || process.env.SESSION_SECRET || process.env.PGPASSWORD || "pagaline-auth-secret";
}

function shouldUseSecureCookie() {
  return process.env.COOKIE_SECURE === "true";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function readCookies(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return new Map<string, string>();

  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) return [part, ""];
        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))];
      }),
  );
}

function serializeAuthCookie(user: AuthUser) {
  const payload = encodeBase64Url(JSON.stringify({
    ...user,
    exp: Date.now() + AUTH_COOKIE_MAX_AGE_MS,
  }));
  return `${payload}.${signPayload(payload)}`;
}

function parseAuthCookie(cookieValue?: string) {
  if (!cookieValue) return undefined;

  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return undefined;
  if (signPayload(payload) !== signature) return undefined;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as AuthUser & { exp?: number };
    if (!parsed?.id || !parsed?.username || !parsed?.displayName) return undefined;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return undefined;

    return {
      id: parsed.id,
      username: parsed.username,
      displayName: parsed.displayName,
      avatarUrl: parsed.avatarUrl,
      isAdmin: Boolean(parsed.isAdmin),
    } satisfies AuthUser;
  } catch {
    return undefined;
  }
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}${HASH_SEPARATOR}${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, stored] = passwordHash.split(HASH_SEPARATOR);
  if (!salt || !stored) return false;

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(derived, "hex"));
}

export function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function toAuthUser<T extends { id: string; username: string; displayName: string; avatarUrl?: string | null; isAdmin: boolean }>(user: T): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
  };
}

export function hydrateAuthUser(req: Request, _res: Response, next: NextFunction) {
  req.authUser = parseAuthCookie(readCookies(req).get(AUTH_COOKIE_NAME));
  next();
}

export function setAuthCookie(res: Response, user: AuthUser) {
  res.cookie(AUTH_COOKIE_NAME, serializeAuthCookie(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ message: "Sessao expirada. Faça login novamente." });
  }

  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ message: "Sessao expirada. Faça login novamente." });
  }

  if (!req.authUser.isAdmin) {
    return res.status(403).json({ message: "Acesso restrito ao administrador." });
  }

  return next();
}

export { normalizeUsername };
