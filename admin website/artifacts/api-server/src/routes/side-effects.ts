import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sideEffectsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const effects = await db
      .select()
      .from(sideEffectsTable)
      .orderBy(asc(sideEffectsTable.name));

    res.json(
      effects.map((e) => ({
        id: e.id,
        name: e.name,
        isSeeded: e.isSeeded,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get side effects error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "name is required" });
    return;
  }
  const trimmed = name.trim();
  try {
    const existing = await db
      .select()
      .from(sideEffectsTable)
      .where(eq(sideEffectsTable.name, trimmed))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "CONFLICT", message: "Side effect with this name already exists", effect: { id: existing[0].id, name: existing[0].name } });
      return;
    }

    const [effect] = await db
      .insert(sideEffectsTable)
      .values({ name: trimmed, isSeeded: false })
      .returning();

    res.status(201).json({
      id: effect.id,
      name: effect.name,
      isSeeded: effect.isSeeded,
      createdAt: effect.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create side effect error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid id" });
    return;
  }
  try {
    const [effect] = await db
      .select()
      .from(sideEffectsTable)
      .where(eq(sideEffectsTable.id, id))
      .limit(1);

    if (!effect) {
      res.status(404).json({ error: "NOT_FOUND", message: "Side effect not found" });
      return;
    }

    if (effect.isSeeded) {
      res.status(403).json({ error: "FORBIDDEN", message: "Cannot delete a predefined side effect" });
      return;
    }

    await db.delete(sideEffectsTable).where(eq(sideEffectsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete side effect error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
