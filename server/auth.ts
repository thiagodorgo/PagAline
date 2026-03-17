import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const HASH_SEPARATOR = ":";

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Sessao expirada. Faça login novamente." });
  }

  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Sessao expirada. Faça login novamente." });
  }

  if (!req.session.user.isAdmin) {
    return res.status(403).json({ message: "Acesso restrito ao administrador." });
  }

  return next();
}

export { normalizeUsername };
