import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { mealTypesTable, mealTypeRecipesTable, recipesTable } from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";

const router: IRouter = Router();

async function getMealTypesWithRecipes() {
  const types = await db
    .select()
    .from(mealTypesTable)
    .orderBy(asc(mealTypesTable.id));

  if (types.length === 0) return [];

  const links = await db
    .select({
      mealTypeId: mealTypeRecipesTable.mealTypeId,
      recipeId: recipesTable.id,
      recipeName: recipesTable.name,
    })
    .from(mealTypeRecipesTable)
    .innerJoin(recipesTable, eq(mealTypeRecipesTable.recipeId, recipesTable.id));

  const recipesByMealType = new Map<number, { id: number; name: string }[]>();
  for (const link of links) {
    const arr = recipesByMealType.get(link.mealTypeId) ?? [];
    arr.push({ id: link.recipeId, name: link.recipeName });
    recipesByMealType.set(link.mealTypeId, arr);
  }

  return types.map((t) => ({
    ...t,
    recipes: recipesByMealType.get(t.id) ?? [],
  }));
}

async function syncRecipes(mealTypeId: number, recipeIds: number[]) {
  await db.delete(mealTypeRecipesTable).where(eq(mealTypeRecipesTable.mealTypeId, mealTypeId));
  if (recipeIds.length > 0) {
    const existing = await db
      .select({ id: recipesTable.id })
      .from(recipesTable)
      .where(inArray(recipesTable.id, recipeIds));
    const validIds = existing.map((r) => r.id);
    if (validIds.length > 0) {
      await db.insert(mealTypeRecipesTable).values(
        validIds.map((rid) => ({ mealTypeId, recipeId: rid }))
      );
    }
  }
}

router.get("/", async (req, res) => {
  try {
    const result = await getMealTypesWithRecipes();
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "List meal types error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, recipeIds } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Name is required" });
      return;
    }
    const [created] = await db
      .insert(mealTypesTable)
      .values({ name: name.trim() })
      .returning();

    if (Array.isArray(recipeIds)) {
      await syncRecipes(created.id, recipeIds);
    }

    const links = await db
      .select({ recipeId: recipesTable.id, recipeName: recipesTable.name })
      .from(mealTypeRecipesTable)
      .innerJoin(recipesTable, eq(mealTypeRecipesTable.recipeId, recipesTable.id))
      .where(eq(mealTypeRecipesTable.mealTypeId, created.id));

    res.status(201).json({
      ...created,
      recipes: links.map((l) => ({ id: l.recipeId, name: l.recipeName })),
    });
  } catch (err) {
    const dbErr = err as { code?: string };
    if (dbErr?.code === "23505") {
      res.status(409).json({ error: "DUPLICATE", message: "A meal type with that name already exists" });
      return;
    }
    req.log.error({ err }, "Create meal type error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Invalid meal type ID" });
      return;
    }
    const { name, recipeIds } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Name is required" });
      return;
    }
    const [updated] = await db
      .update(mealTypesTable)
      .set({ name: name.trim() })
      .where(eq(mealTypesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND", message: "Meal type not found" });
      return;
    }

    if (Array.isArray(recipeIds)) {
      await syncRecipes(id, recipeIds);
    }

    const links = await db
      .select({ recipeId: recipesTable.id, recipeName: recipesTable.name })
      .from(mealTypeRecipesTable)
      .innerJoin(recipesTable, eq(mealTypeRecipesTable.recipeId, recipesTable.id))
      .where(eq(mealTypeRecipesTable.mealTypeId, id));

    res.json({
      ...updated,
      recipes: links.map((l) => ({ id: l.recipeId, name: l.recipeName })),
    });
  } catch (err) {
    const dbErr = err as { code?: string };
    if (dbErr?.code === "23505") {
      res.status(409).json({ error: "DUPLICATE", message: "A meal type with that name already exists" });
      return;
    }
    req.log.error({ err }, "Update meal type error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Invalid meal type ID" });
      return;
    }
    const [deleted] = await db
      .delete(mealTypesTable)
      .where(eq(mealTypesTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "NOT_FOUND", message: "Meal type not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete meal type error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
