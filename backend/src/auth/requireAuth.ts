import { NextFunction, Request, Response } from "express";
import { verifySession, SessionPayload } from "./jwt";
import { SESSION_COOKIE } from "./cookie";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? verifySession(token) : null;

  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.session = session;
  next();
}
