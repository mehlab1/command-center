import { Response } from "express";
import { env } from "../config/env";

export const SESSION_COOKIE = "session";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string): void {
  // Frontend (vercel.app) and backend (onrender.com) are different
  // registrable domains — this is a genuinely cross-site deployment, not
  // just cross-port like local dev. SameSite=Lax blocks cookies on
  // cross-site fetch() (it only allows top-level navigations), so the
  // session cookie never came back on any dashboard/chat API call in
  // production. SameSite=None requires Secure, which local dev over HTTP
  // can't satisfy, so this only applies in production.
  const isProd = env.nodeEnv === "production";
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: SEVEN_DAYS_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  const isProd = env.nodeEnv === "production";
  res.clearCookie(SESSION_COOKIE, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
}
