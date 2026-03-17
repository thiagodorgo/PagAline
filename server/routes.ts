import type { Express, Request } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { createOcrUploadTarget, extractBillFromUploadedDocument } from "./ocr";
import {
  insertBillSchema,
  updateBillSchema,
  insertCategorySchema,
  updateSettingsSchema,
  createUserCredentialsSchema,
  loginSchema,
  updateUserProfileSchema,
} from "@shared/schema";
import { z } from "zod";
import { normalizeUsername, requireAdmin, requireAuth, sanitizeUser, verifyPassword } from "./auth";

function regenerateSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function destroySession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await storage.seedDefaults();

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post("/api/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Credenciais inválidas." });
    }

    const username = normalizeUsername(parsed.data.username);
    const user = await storage.getUserByUsername(username);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ message: "Usuário ou senha inválidos." });
    }

    const safeUser = sanitizeUser(user);
    await regenerateSession(req);
    req.session.user = safeUser;
    await saveSession(req);
    return res.json(safeUser);
  });

  app.post("/api/logout", async (req, res) => {
    await destroySession(req);
    res.status(204).send();
  });

  app.get("/api/me", (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Nao autenticado." });
    }

    return res.json(req.session.user);
  });

  app.post("/api/device-login/redeem", async (req, res) => {
    const schema = z.object({ token: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Token inválido." });
    }

    const user = await storage.consumeDeviceLoginToken(parsed.data.token);
    if (!user) {
      return res.status(401).json({ message: "QR expirado ou já utilizado." });
    }

    const safeUser = sanitizeUser(user);
    await regenerateSession(req);
    req.session.user = safeUser;
    await saveSession(req);
    return res.json(safeUser);
  });

  app.patch("/api/me", requireAuth, async (req, res) => {
    const parsed = updateUserProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos.", errors: parsed.error.flatten() });
    }

    const updated = await storage.updateUser(req.session.user!.id, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const safeUser = sanitizeUser(updated);
    req.session.user = safeUser;
    await saveSession(req);
    return res.json(safeUser);
  });

  app.use("/api", requireAuth);

  app.post("/api/device-login-token", async (req, res) => {
    const { token, expiresAt } = await storage.createDeviceLoginToken(req.session.user!.id);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({
      token,
      expiresAt,
      url: `${baseUrl}/login/access?token=${token}`,
    });
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users.map(sanitizeUser));
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    const parsed = createUserCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos.", errors: parsed.error.flatten() });
    }

    const username = normalizeUsername(parsed.data.username);
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ message: "Usuário já existe." });
    }

    const created = await storage.createUser({
      username,
      password: parsed.data.password,
      isAdmin: parsed.data.isAdmin ?? false,
      displayName: parsed.data.username.trim(),
    });

    res.status(201).json(sanitizeUser(created));
  });

  app.get("/api/bills", async (_req, res) => {
    const bills = await storage.getBills();
    res.json(bills);
  });

  app.get("/api/bills/:id", async (req, res) => {
    const bill = await storage.getBill(req.params.id);
    if (!bill) return res.status(404).json({ message: "Conta não encontrada" });
    res.json(bill);
  });

  app.post("/api/bills", async (req, res) => {
    const parsed = insertBillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    const bill = await storage.createBill(parsed.data);
    res.status(201).json(bill);
  });

  app.patch("/api/bills/:id", async (req, res) => {
    const parsed = updateBillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    const bill = await storage.updateBill(req.params.id, parsed.data);
    if (!bill) return res.status(404).json({ message: "Conta não encontrada" });
    res.json(bill);
  });

  app.delete("/api/bills/:id", async (req, res) => {
    await storage.deleteBill(req.params.id);
    res.status(204).send();
  });

  app.post("/api/bills/:id/pay", async (req, res) => {
    const bill = await storage.markBillPaid(req.params.id);
    if (!bill) return res.status(404).json({ message: "Conta não encontrada" });
    res.json(bill);
  });

  app.post("/api/ocr/presign", async (req, res) => {
    const schema = z.object({
      fileName: z.string().min(1),
      contentType: z.string().min(1),
      fileSize: z.number().positive().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    const target = await createOcrUploadTarget(parsed.data);
    res.json(target);
  });

  app.post("/api/ocr/extract", async (req, res) => {
    const schema = z.object({ key: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    const suggestion = await extractBillFromUploadedDocument(parsed.data.key);
    res.json(suggestion);
  });

  app.post("/api/bills/pay-multiple", async (req, res) => {
    const schema = z.object({ ids: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
    await storage.markMultipleBillsPaid(parsed.data.ids);
    res.json({ success: true });
  });

  app.get("/api/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post("/api/categories", async (req, res) => {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
    try {
      const cat = await storage.createCategory(parsed.data);
      res.status(201).json(cat);
    } catch (e: any) {
      if (e.code === "23505") return res.status(409).json({ message: "Categoria já existe" });
      throw e;
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    await storage.deleteCategory(req.params.id);
    res.status(204).send();
  });

  app.get("/api/settings", async (_req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.patch("/api/settings", async (req, res) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
    const s = await storage.updateSettings(parsed.data);
    res.json(s);
  });

  app.post("/api/reset", async (_req, res) => {
    await storage.resetAll();
    res.json({ success: true });
  });

  return httpServer;
}
