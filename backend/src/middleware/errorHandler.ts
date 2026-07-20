import { NextFunction, Request, Response } from "express";

// Catches anything a route handler throws/rejects. Never leak stack traces or
// raw error messages (connection strings, query details) to the client.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
