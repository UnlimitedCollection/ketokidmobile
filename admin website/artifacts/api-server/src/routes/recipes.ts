import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { recipesTable, recipeIngredientsTable, foodsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

const router: IRouter = Router();

type IngredientInput = {
  foodName: string;
  portionGrams: number;
};

function validatePortion(portionGrams: unknown): number | null {
  const v = Number(portionGrams);
  if (isNaN(v) || v <= 0 || v > 10000) return null;
  return v;
}

async function computeMacros(foodName: string, portionGrams: number) {
  const [food] = await db
    .select()
    .from(foodsTable)
    .where(ilike(foodsTable.name, foodName.trim()))
    .limit(1);

  if (!food) {
    return { carbs: 0, fat: 0, protein: 0, calories: 0 };
  }

  const ratio = portionGrams / 100;
  return {
    carbs:    Math.round((food.carbs    * ratio) * 100) / 100,
    fat:      Math.round((food.fat      * ratio) * 100) / 100,
    protein:  Math.round((food.protein  * ratio) * 100) / 100,
    calories: Math.round((food.calories * ratio) * 100) / 100,
  };
}

function calcTotals(ingredients: typeof recipeIngredientsTable.$inferSelect[]) {
  return ingredients.reduce(
    (acc, ing) => ({
      totalCarbs:    acc.totalCarbs    + (ing.carbs    ?? 0),
      totalFat:      acc.totalFat      + (ing.fat      ?? 0),
      totalProtein:  acc.totalProtein  + (ing.protein  ?? 0),
      totalCalories: acc.totalCalories + (ing.calories ?? 0),
    }),
    { totalCarbs: 0, totalFat: 0, totalProtein: 0, totalCalories: 0 }
  );
}

router.get("/", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isPrivileged = req.session.doctorRole === "moderator" || req.session.doctorRole === "admin";
  try {
    const recipes = isPrivileged
      ? await db.select().from(recipesTable)
      : await db.select().from(recipesTable).where(eq(recipesTable.doctorId, doctorId));

    const result = await Promise.all(
      recipes.map(async (r) => {
        const ingredients = await db
          .select()
          .from(recipeIngredientsTable)
          .where(eq(recipeIngredientsTable.recipeId, r.id));
        const totals = calcTotals(ingredients);
        return { ...r, ingredients, ...totals };
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "List recipes error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const { name, description, category, imageUrl, ingredients } = req.body as {
    name: string;
    description?: string;
    category?: string;
    imageUrl?: string;
    ingredients?: IngredientInput[];
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Recipe name is required" });
    return;
  }

  if (description && description.length > 1000) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Description must be 1000 characters or fewer" });
    return;
  }

  try {
    const [recipe] = await db
      .insert(recipesTable)
      .values({
        doctorId,
        name: name.trim(),
        description: description ?? "",
        category: category ?? "General",
        imageUrl: imageUrl ?? "",
      })
      .returning();

    const insertedIngredients: typeof recipeIngredientsTable.$inferSelect[] = [];
    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        if (!ing.foodName?.trim()) continue;
        const portion = validatePortion(ing.portionGrams) ?? 100;
        const macros = await computeMacros(ing.foodName, portion);
        const [inserted] = await db
          .insert(recipeIngredientsTable)
          .values({
            recipeId: recipe.id,
            foodName: ing.foodName.trim(),
            portionGrams: portion,
            unit: "g",
            ...macros,
          })
          .returning();
        insertedIngredients.push(inserted);
      }
    }

    const totals = calcTotals(insertedIngredients);
    res.status(201).json({ ...recipe, ingredients: insertedIngredients, ...totals });
  } catch (err) {
    req.log.error({ err }, "Create recipe error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:recipeId", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isPrivileged = req.session.doctorRole === "moderator" || req.session.doctorRole === "admin";
  const recipeId = parseInt(req.params.recipeId);

  if (isNaN(recipeId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid recipe ID" });
    return;
  }

  try {
    const recipeWhere = isPrivileged
      ? eq(recipesTable.id, recipeId)
      : and(eq(recipesTable.id, recipeId), eq(recipesTable.doctorId, doctorId));
    const [recipe] = await db
      .select()
      .from(recipesTable)
      .where(recipeWhere);

    if (!recipe) {
      res.status(404).json({ error: "NOT_FOUND", message: "Recipe not found" });
      return;
    }

    const ingredients = await db
      .select()
      .from(recipeIngredientsTable)
      .where(eq(recipeIngredientsTable.recipeId, recipeId));

    const totals = calcTotals(ingredients);
    res.json({ ...recipe, ingredients, ...totals });
  } catch (err) {
    req.log.error({ err }, "Get recipe error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:recipeId", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";
  const recipeId = parseInt(req.params.recipeId);

  if (isNaN(recipeId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid recipe ID" });
    return;
  }

  const { name, description, category, imageUrl, ingredients } = req.body as {
    name?: string;
    description?: string;
    category?: string;
    imageUrl?: string;
    ingredients?: IngredientInput[];
  };

  if (description && description.length > 1000) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Description must be 1000 characters or fewer" });
    return;
  }

  try {
    const recipeWhere = isAdmin
      ? eq(recipesTable.id, recipeId)
      : and(eq(recipesTable.id, recipeId), eq(recipesTable.doctorId, doctorId));
    const [existing] = await db
      .select()
      .from(recipesTable)
      .where(recipeWhere);

    if (!existing) {
      res.status(404).json({ error: "NOT_FOUND", message: "Recipe not found" });
      return;
    }

    const [updated] = await db
      .update(recipesTable)
      .set({
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category ? { category } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(recipesTable.id, recipeId))
      .returning();

    if (ingredients !== undefined) {
      await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipeId));
      for (const ing of ingredients) {
        if (!ing.foodName?.trim()) continue;
        const portion = validatePortion(ing.portionGrams) ?? 100;
        const macros = await computeMacros(ing.foodName, portion);
        await db.insert(recipeIngredientsTable).values({
          recipeId,
          foodName: ing.foodName.trim(),
          portionGrams: portion,
          unit: "g",
          ...macros,
        });
      }
    }

    const freshIngredients = await db
      .select()
      .from(recipeIngredientsTable)
      .where(eq(recipeIngredientsTable.recipeId, recipeId));

    const totals = calcTotals(freshIngredients);
    res.json({ ...updated, ingredients: freshIngredients, ...totals });
  } catch (err) {
    req.log.error({ err }, "Update recipe error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:recipeId", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";
  const recipeId = parseInt(req.params.recipeId);

  if (isNaN(recipeId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid recipe ID" });
    return;
  }

  try {
    const recipeWhere = isAdmin
      ? eq(recipesTable.id, recipeId)
      : and(eq(recipesTable.id, recipeId), eq(recipesTable.doctorId, doctorId));
    const [existing] = await db
      .select()
      .from(recipesTable)
      .where(recipeWhere);

    if (!existing) {
      res.status(404).json({ error: "NOT_FOUND", message: "Recipe not found" });
      return;
    }

    await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipeId));
    await db.delete(recipesTable).where(eq(recipesTable.id, recipeId));
    res.json({ success: true, message: "Recipe deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete recipe error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/:recipeId/ingredients", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";
  const recipeId = parseInt(req.params.recipeId);

  if (isNaN(recipeId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid recipe ID" });
    return;
  }

  const { foodName, portionGrams } = req.body as IngredientInput;

  if (!foodName?.trim()) {
    res.status(400).json({ error: "BAD_REQUEST", message: "foodName is required" });
    return;
  }

  try {
    const recipeWhere = isAdmin
      ? eq(recipesTable.id, recipeId)
      : and(eq(recipesTable.id, recipeId), eq(recipesTable.doctorId, doctorId));
    const [recipe] = await db
      .select()
      .from(recipesTable)
      .where(recipeWhere);

    if (!recipe) {
      res.status(404).json({ error: "NOT_FOUND", message: "Recipe not found" });
      return;
    }

    const macros = await computeMacros(foodName, portionGrams ?? 100);
    const [ingredient] = await db
      .insert(recipeIngredientsTable)
      .values({
        recipeId,
        foodName: foodName.trim(),
        portionGrams: portionGrams ?? 100,
        unit: "g",
        ...macros,
      })
      .returning();

    res.status(201).json(ingredient);
  } catch (err) {
    req.log.error({ err }, "Add ingredient error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:recipeId/ingredients/:ingId", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";
  const recipeId = parseInt(req.params.recipeId);
  const ingId = parseInt(req.params.ingId);

  if (isNaN(recipeId) || isNaN(ingId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid ID" });
    return;
  }

  try {
    const recipeWhere = isAdmin
      ? eq(recipesTable.id, recipeId)
      : and(eq(recipesTable.id, recipeId), eq(recipesTable.doctorId, doctorId));
    const [recipe] = await db
      .select()
      .from(recipesTable)
      .where(recipeWhere);

    if (!recipe) {
      res.status(404).json({ error: "NOT_FOUND", message: "Recipe not found" });
      return;
    }

    await db.delete(recipeIngredientsTable).where(
      and(eq(recipeIngredientsTable.id, ingId), eq(recipeIngredientsTable.recipeId, recipeId))
    );

    res.json({ success: true, message: "Ingredient removed" });
  } catch (err) {
    req.log.error({ err }, "Remove ingredient error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
