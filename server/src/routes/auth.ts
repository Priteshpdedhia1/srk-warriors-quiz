import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../env";
export const auth = Router();
const body = z.object({ password: z.string() });
auth.post("/host/login", (req, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Bad request" });
  if (parsed.data.password !== env.HOST_PASSWORD)
    return res.status(401).json({ ok: false, error: "Wrong password" });
  const token = jwt.sign({ role: "host" }, env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ ok: true, token });
});
export function verifyHost(token: string): boolean {
  try { const d = jwt.verify(token, env.JWT_SECRET) as any; return d.role === "host"; }
  catch { return false; }
}
