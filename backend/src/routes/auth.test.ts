import request from "supertest";

jest.mock("../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

process.env.JWT_SECRET = "test-secret";
process.env.VAULT_ENCRYPTION_KEY = "laU4ED0ckoRFTzhg9zBTdT2CuATiY7aQhHd8l3eKAtg=";

import { createApp } from "../app";
import { prisma } from "../lib/prisma";

const app = createApp();

describe("POST /api/auth/login", () => {
  it("rejects a malformed body before touching the database", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown email without revealing which field was wrong", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });
});

describe("GET /api/auth/me", () => {
  it("requires a session cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
