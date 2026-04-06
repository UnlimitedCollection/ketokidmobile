import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { foodsTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import { CreateFoodBody, UpdateFoodBody, GetFoodsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const parsed = GetFoodsQueryParams.safeParse(req.query);
    const search = parsed.success ? parsed.data.search : undefined;
    const category = parsed.success ? parsed.data.category : undefined;

    const conditions = [];
    if (search) conditions.push(ilike(foodsTable.name, `%${search}%`));
    if (category) conditions.push(eq(foodsTable.category, category));

    const foods = await db
      .select()
      .from(foodsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json(foods);
  } catch (err) {
    req.log.error({ err }, "Get foods error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreateFoodBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }

    const [food] = await db
      .insert(foodsTable)
      .values({
        name: parsed.data.name,
        category: parsed.data.category,
        carbs: parsed.data.carbs,
        fat: parsed.data.fat,
        protein: parsed.data.protein,
        calories: parsed.data.calories,
        imageUrl: parsed.data.imageUrl ?? "",
        description: parsed.data.description ?? "",
        indicator: parsed.data.indicator ?? "vegi",
      })
      .returning();

    res.status(201).json(food);
  } catch (err) {
    req.log.error({ err }, "Create food error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:foodId", async (req, res) => {
  try {
    const foodId = parseInt(req.params.foodId, 10);
    const [food] = await db.select().from(foodsTable).where(eq(foodsTable.id, foodId)).limit(1);
    if (!food) {
      res.status(404).json({ error: "NOT_FOUND", message: "Food not found" });
      return;
    }
    res.json(food);
  } catch (err) {
    req.log.error({ err }, "Get food error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:foodId", async (req, res) => {
  try {
    const foodId = parseInt(req.params.foodId, 10);
    const parsed = UpdateFoodBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }

    const [food] = await db
      .update(foodsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(foodsTable.id, foodId))
      .returning();

    if (!food) {
      res.status(404).json({ error: "NOT_FOUND", message: "Food not found" });
      return;
    }

    res.json(food);
  } catch (err) {
    req.log.error({ err }, "Update food error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:foodId", async (req, res) => {
  try {
    const foodId = parseInt(req.params.foodId, 10);
    await db.delete(foodsTable).where(eq(foodsTable.id, foodId));
    res.json({ success: true, message: "Food deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete food error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
