import { PrismaClient } from "@prisma/client";

// Single shared instance — Render free tier runs one process, no need for
// the dev-hot-reload global-caching pattern used in serverless setups.
export const prisma = new PrismaClient();
