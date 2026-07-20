import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface SessionPayload {
  userId: string;
  email: string;
}

const SESSION_TTL = "7d";

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: SESSION_TTL });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as SessionPayload;
  } catch {
    return null;
  }
}
