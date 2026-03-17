import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { createOcrUploadTarget, extractBillFromUploadedDocument } from "./ocr";
import { insertBillSchema, updateBillSchema, insertCategorySchema, updateSettingsSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await storage.seedDefaults();

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
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
