import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth";
import { registerPushToken } from "../services/pushService";

export const pushRouter = Router();
pushRouter.use(requireAuth);

const registerSchema = z.object({ token: z.string().min(1) });

pushRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  await registerPushToken(parsed.data.token);
  res.status(200).json({ ok: true });
});
