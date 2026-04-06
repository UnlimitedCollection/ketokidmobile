import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { parentTokensTable, kidsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

function generateToken(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(7);
  const l1 = letters[bytes[0] % 26];
  const l2 = letters[bytes[1] % 26];
  const l3 = letters[bytes[2] % 26];
  const digits = (
    ((bytes[3] << 24) | (bytes[4] << 16) | (bytes[5] << 8) | bytes[6]) >>> 0
  ) % 10000;
  return `${l1}${l2}${l3}-${String(digits).padStart(4, "0")}`;
}

async function generateUniqueToken(existingId?: number, maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateToken();
    const conflict = await db
      .select({ id: parentTokensTable.id })
      .from(parentTokensTable)
      .where(eq(parentTokensTable.token, candidate));
    const isSelf = existingId !== undefined && conflict.length === 1 && conflict[0].id === existingId;
    if (conflict.length === 0 || isSelf) return candidate;
  }
  throw new Error("Could not generate a unique token after multiple attempts");
}

function computeStatus(token: typeof parentTokensTable.$inferSelect): string {
  if (token.status === "revoked") return "revoked";
  if (new Date(token.expiresAt) < new Date()) return "expired";
  return token.status;
}

router.get("/", async (req, res) => {
  const doctorId = req.session.doctorId!;
  try {
    const kids = await db
      .select({ id: kidsTable.id, name: kidsTable.name })
      .from(kidsTable)
      .where(eq(kidsTable.doctorId, doctorId));

    if (kids.length === 0) {
      res.json([]);
      return;
    }

    const kidIds = kids.map((k) => k.id);
    const kidMap = new Map(kids.map((k) => [k.id, k.name]));

    const tokens = await db
      .select()
      .from(parentTokensTable)
      .where(inArray(parentTokensTable.kidId, kidIds));

    const result = tokens.map((t) => ({
      id: t.id,
      kidId: t.kidId,
      kidName: kidMap.get(t.kidId) ?? "Unknown",
      token: t.token,
      status: computeStatus(t),
      expiresAt: t.expiresAt.toISOString(),
      usedAt: t.usedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "List tokens error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const { kidId, expiresInDays = 90 } = req.body as { kidId: number; expiresInDays?: number };

  if (!kidId || typeof kidId !== "number") {
    res.status(400).json({ error: "BAD_REQUEST", message: "kidId is required" });
    return;
  }

  const days = Number(expiresInDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    res.status(400).json({ error: "BAD_REQUEST", message: "expiresInDays must be between 1 and 365" });
    return;
  }

  try {
    const [kid] = await db
      .select()
      .from(kidsTable)
      .where(and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId)));

    if (!kid) {
      res.status(404).json({ error: "NOT_FOUND", message: "Child not found" });
      return;
    }

    const existing = await db
      .select()
      .from(parentTokensTable)
      .where(eq(parentTokensTable.kidId, kidId));

    const tokenStr = await generateUniqueToken(existing[0]?.id);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(parentTokensTable)
        .set({ token: tokenStr, status: "active", expiresAt, usedAt: null })
        .where(eq(parentTokensTable.id, existing[0].id))
        .returning();
    } else {
      [result] = await db
        .insert(parentTokensTable)
        .values({ kidId, token: tokenStr, status: "active", expiresAt })
        .returning();
    }

    res.status(201).json({
      id: result.id,
      kidId: result.kidId,
      kidName: kid.name,
      token: result.token,
      status: computeStatus(result),
      expiresAt: result.expiresAt.toISOString(),
      usedAt: result.usedAt?.toISOString() ?? null,
      createdAt: result.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create token error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:tokenId/reset", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const tokenId = parseInt(req.params.tokenId);

  if (isNaN(tokenId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid token ID" });
    return;
  }

  try {
    const [existing] = await db
      .select({ t: parentTokensTable, k: kidsTable })
      .from(parentTokensTable)
      .innerJoin(kidsTable, eq(kidsTable.id, parentTokensTable.kidId))
      .where(and(eq(parentTokensTable.id, tokenId), eq(kidsTable.doctorId, doctorId)));

    if (!existing) {
      res.status(404).json({ error: "NOT_FOUND", message: "Token not found" });
      return;
    }

    const newToken = await generateUniqueToken(tokenId);
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(parentTokensTable)
      .set({ token: newToken, status: "active", expiresAt, usedAt: null })
      .where(eq(parentTokensTable.id, tokenId))
      .returning();

    res.json({
      id: updated.id,
      kidId: updated.kidId,
      kidName: existing.k.name,
      token: updated.token,
      status: computeStatus(updated),
      expiresAt: updated.expiresAt.toISOString(),
      usedAt: updated.usedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Reset token error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:tokenId", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const tokenId = parseInt(req.params.tokenId);

  if (isNaN(tokenId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid token ID" });
    return;
  }

  try {
    const [existing] = await db
      .select({ t: parentTokensTable, k: kidsTable })
      .from(parentTokensTable)
      .innerJoin(kidsTable, eq(kidsTable.id, parentTokensTable.kidId))
      .where(and(eq(parentTokensTable.id, tokenId), eq(kidsTable.doctorId, doctorId)));

    if (!existing) {
      res.status(404).json({ error: "NOT_FOUND", message: "Token not found" });
      return;
    }

    await db
      .update(parentTokensTable)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(parentTokensTable.id, tokenId));

    res.json({ success: true, message: "Token revoked" });
  } catch (err) {
    req.log.error({ err }, "Revoke token error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
