import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  parentTokensTable,
  kidsTable,
  medicalSettingsTable,
  foodsTable,
  mealTypesTable,
  parentMealPlansTable,
  parentMealPlanFoodsTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";

const router = Router();

function requireParent(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.parentKidId) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Parent authentication required" });
    return;
  }
  next();
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      res.status(400).json({ message: "Token is required" });
      return;
    }

    const [pt] = await db
      .select()
      .from(parentTokensTable)
      .where(eq(parentTokensTable.token, token.trim()))
      .limit(1);

    if (!pt) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }
    if (pt.status !== "active") {
      res.status(401).json({ message: "Token is no longer active" });
      return;
    }
    if (pt.expiresAt && new Date(pt.expiresAt) < new Date()) {
      res.status(401).json({ message: "Token has expired" });
      return;
    }

    const [kid] = await db.select().from(kidsTable).where(eq(kidsTable.id, pt.kidId)).limit(1);
    if (!kid) {
      res.status(404).json({ message: "Child not found" });
      return;
    }

    const [settings] = await db
      .select()
      .from(medicalSettingsTable)
      .where(eq(medicalSettingsTable.kidId, kid.id))
      .limit(1);

    await db
      .update(parentTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(parentTokensTable.id, pt.id));

    req.session.parentKidId = kid.id;
    req.session.parentKidName = kid.name;

    res.json({
      success: true,
      child: {
        id: kid.id,
        name: kid.name,
        kidCode: kid.kidCode,
        dateOfBirth: kid.dateOfBirth,
        gender: kid.gender,
        dietType: kid.dietType,
        dietSubCategory: kid.dietSubCategory || null,
        ketoRatio: settings?.ketoRatio?.toString() || null,
        dailyCalories: settings?.dailyCalories || null,
        dailyCarbs: settings?.dailyCarbs || null,
        dailyFat: settings?.dailyFat || null,
        dailyProtein: settings?.dailyProtein || null,
        parentName: kid.parentName,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Parent login error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.status(204).send();
  });
});

router.use(requireParent);

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const kidId = req.session.parentKidId!;
    const today = todayDate();

    const [kid] = await db.select().from(kidsTable).where(eq(kidsTable.id, kidId)).limit(1);
    if (!kid) { res.status(404).json({ message: "Child not found" }); return; }

    const [settings] = await db
      .select()
      .from(medicalSettingsTable)
      .where(eq(medicalSettingsTable.kidId, kidId))
      .limit(1);

    const mealTypes = await db
      .select()
      .from(mealTypesTable)
      .orderBy(asc(mealTypesTable.id));

    const todayPlans = await db
      .select()
      .from(parentMealPlansTable)
      .where(and(eq(parentMealPlansTable.kidId, kidId), eq(parentMealPlansTable.date, today)));

    const mealIcons: Record<string, string> = {
      breakfast: "light_mode",
      lunch: "sunny",
      dinner: "dark_mode",
      snack: "cookie",
      "morning snack": "cookie",
      "afternoon snack": "cookie",
    };

    const todayMeals = [];
    let carbsConsumed = 0, fatConsumed = 0, proteinConsumed = 0, caloriesConsumed = 0;

    for (let idx = 0; idx < mealTypes.length; idx++) {
      const mt = mealTypes[idx];
      const plan = todayPlans.find((p) => p.mealTypeId === mt.id);

      let foods: any[] = [];
      if (plan) {
        const planFoods = await db
          .select({
            id: parentMealPlanFoodsTable.id,
            foodId: parentMealPlanFoodsTable.foodId,
            foodName: foodsTable.name,
            foodImage: foodsTable.imageUrl,
            category: foodsTable.category,
            carbs: foodsTable.carbs,
            fat: foodsTable.fat,
            protein: foodsTable.protein,
            calories: foodsTable.calories,
            servingSize: foodsTable.servingSize,
            servingUnit: foodsTable.servingUnit,
          })
          .from(parentMealPlanFoodsTable)
          .innerJoin(foodsTable, eq(parentMealPlanFoodsTable.foodId, foodsTable.id))
          .where(eq(parentMealPlanFoodsTable.mealPlanId, plan.id))
          .orderBy(asc(parentMealPlanFoodsTable.sortOrder));

        foods = planFoods.map((f) => ({
          ...f,
          quantity: `${f.servingSize ?? 1} ${f.servingUnit ?? "serve"}`,
        }));

        if (plan.ateStatus === "yes") {
          const pct = (plan.portionPercent ?? 100) / 100;
          carbsConsumed += (plan.totalCarbs ?? 0) * pct;
          fatConsumed += (plan.totalFat ?? 0) * pct;
          proteinConsumed += (plan.totalProtein ?? 0) * pct;
          caloriesConsumed += (plan.totalCalories ?? 0) * pct;
        }
      }

      let status: string;
      if (!plan) status = "empty";
      else if (plan.ateStatus === "yes") status = "consumed";
      else if (plan.ateStatus === "no") status = "not_involved";
      else status = "planned";

      todayMeals.push({
        mealTypeId: mt.id,
        mealTypeName: mt.name,
        status,
        mealPlanId: plan?.id || null,
        foods,
        ateStatus: plan?.ateStatus || "unknown",
        portionPercent: plan?.portionPercent ?? null,
      });
    }

    const carbsTarget = settings?.dailyCarbs || 20;
    const fatTarget = settings?.dailyFat || 100;
    const proteinTarget = settings?.dailyProtein || 40;
    const caloriesTarget = settings?.dailyCalories || 1200;

    const overallPercent = Math.round(
      ((carbsConsumed / carbsTarget + fatConsumed / fatTarget + proteinConsumed / proteinTarget + caloriesConsumed / caloriesTarget) / 4) * 100
    );

    res.json({
      child: {
        id: kid.id,
        name: kid.name,
        kidCode: kid.kidCode,
        dateOfBirth: kid.dateOfBirth,
        gender: kid.gender,
        dietType: kid.dietType,
        dietSubCategory: kid.dietSubCategory || null,
        ketoRatio: settings?.ketoRatio?.toString() || null,
        dailyCalories: settings?.dailyCalories || null,
        dailyCarbs: settings?.dailyCarbs || null,
        dailyFat: settings?.dailyFat || null,
        dailyProtein: settings?.dailyProtein || null,
        parentName: kid.parentName,
      },
      mealTypes: mealTypes.map((mt, idx) => ({
        id: mt.id,
        name: mt.name,
        sortOrder: idx,
        icon: mealIcons[mt.name.toLowerCase()] || "restaurant",
      })),
      todayMeals,
      dailyProgress: {
        carbsConsumed: Math.round(carbsConsumed * 10) / 10,
        carbsTarget,
        fatConsumed: Math.round(fatConsumed * 10) / 10,
        fatTarget,
        proteinConsumed: Math.round(proteinConsumed * 10) / 10,
        proteinTarget,
        caloriesConsumed: Math.round(caloriesConsumed * 10) / 10,
        caloriesTarget,
        overallPercent: Math.min(overallPercent, 100),
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Dashboard error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/foods", async (req: Request, res: Response) => {
  try {
    const kpi = (req.query.kpi as string) || "carbs";
    const orderCol =
      kpi === "fat" ? foodsTable.fat :
      kpi === "protein" ? foodsTable.protein :
      kpi === "calories" ? foodsTable.calories :
      foodsTable.carbs;

    const foods = await db
      .select()
      .from(foodsTable)
      .where(eq(foodsTable.isActive, true))
      .orderBy(asc(orderCol))
      .limit(50);

    res.json(
      foods.map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        carbs: f.carbs,
        fat: f.fat,
        protein: f.protein,
        calories: f.calories,
        imageUrl: f.imageUrl || null,
        description: f.description || null,
        indicator: f.indicator || null,
        servingSize: f.servingSize ?? 1,
        servingUnit: f.servingUnit ?? "serve",
        quantity: `${f.servingSize ?? 1} ${f.servingUnit ?? "serve"}`,
      }))
    );
  } catch (err) {
    req.log?.error({ err }, "Foods error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/meal-plans", async (req: Request, res: Response) => {
  try {
    const kidId = req.session.parentKidId!;
    const { mealTypeId, foodIds } = req.body;
    const today = todayDate();

    if (!mealTypeId || !Array.isArray(foodIds) || foodIds.length === 0) {
      res.status(400).json({ message: "mealTypeId and foodIds are required" });
      return;
    }

    const foods = await db
      .select()
      .from(foodsTable)
      .where(sql`${foodsTable.id} IN (${sql.join(foodIds.map((id: number) => sql`${id}`), sql`, `)})`);

    const totalCalories = foods.reduce((s, f) => s + f.calories, 0);
    const totalCarbs = foods.reduce((s, f) => s + f.carbs, 0);
    const totalFat = foods.reduce((s, f) => s + f.fat, 0);
    const totalProtein = foods.reduce((s, f) => s + f.protein, 0);

    const existing = await db
      .select()
      .from(parentMealPlansTable)
      .where(and(
        eq(parentMealPlansTable.kidId, kidId),
        eq(parentMealPlansTable.mealTypeId, mealTypeId),
        eq(parentMealPlansTable.date, today)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(parentMealPlanFoodsTable).where(eq(parentMealPlanFoodsTable.mealPlanId, existing[0].id));
      await db
        .update(parentMealPlansTable)
        .set({ totalCalories, totalCarbs, totalFat, totalProtein, updatedAt: new Date() })
        .where(eq(parentMealPlansTable.id, existing[0].id));

      for (let i = 0; i < foodIds.length; i++) {
        await db.insert(parentMealPlanFoodsTable).values({
          mealPlanId: existing[0].id,
          foodId: foodIds[i],
          sortOrder: i,
        });
      }

      res.json({ mealPlanId: existing[0].id });
      return;
    }

    const [plan] = await db
      .insert(parentMealPlansTable)
      .values({
        kidId,
        mealTypeId,
        date: today,
        totalCalories,
        totalCarbs,
        totalFat,
        totalProtein,
      })
      .returning();

    for (let i = 0; i < foodIds.length; i++) {
      await db.insert(parentMealPlanFoodsTable).values({
        mealPlanId: plan.id,
        foodId: foodIds[i],
        sortOrder: i,
      });
    }

    res.json({ mealPlanId: plan.id });
  } catch (err) {
    req.log?.error({ err }, "Save meal plan error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/meal-plans/:id", async (req: Request, res: Response) => {
  try {
    const mealPlanId = Number(req.params.id);
    const kidId = req.session.parentKidId!;
    const { foodIds } = req.body;

    if (!Array.isArray(foodIds) || foodIds.length === 0) {
      res.status(400).json({ message: "foodIds required" });
      return;
    }

    const [plan] = await db
      .select()
      .from(parentMealPlansTable)
      .where(and(eq(parentMealPlansTable.id, mealPlanId), eq(parentMealPlansTable.kidId, kidId)))
      .limit(1);

    if (!plan) { res.status(404).json({ message: "Meal plan not found" }); return; }

    const foods = await db
      .select()
      .from(foodsTable)
      .where(sql`${foodsTable.id} IN (${sql.join(foodIds.map((id: number) => sql`${id}`), sql`, `)})`);

    const totalCalories = foods.reduce((s, f) => s + f.calories, 0);
    const totalCarbs = foods.reduce((s, f) => s + f.carbs, 0);
    const totalFat = foods.reduce((s, f) => s + f.fat, 0);
    const totalProtein = foods.reduce((s, f) => s + f.protein, 0);

    await db.delete(parentMealPlanFoodsTable).where(eq(parentMealPlanFoodsTable.mealPlanId, mealPlanId));
    await db
      .update(parentMealPlansTable)
      .set({ totalCalories, totalCarbs, totalFat, totalProtein, updatedAt: new Date() })
      .where(eq(parentMealPlansTable.id, mealPlanId));

    for (let i = 0; i < foodIds.length; i++) {
      await db.insert(parentMealPlanFoodsTable).values({
        mealPlanId,
        foodId: foodIds[i],
        sortOrder: i,
      });
    }

    res.status(204).send();
  } catch (err) {
    req.log?.error({ err }, "Update meal plan error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/meal-plans/copy", async (req: Request, res: Response) => {
  try {
    const kidId = req.session.parentKidId!;
    const { sourceMealTypeId, targetMealTypeId } = req.body;
    const today = todayDate();

    const [source] = await db
      .select()
      .from(parentMealPlansTable)
      .where(and(
        eq(parentMealPlansTable.kidId, kidId),
        eq(parentMealPlansTable.mealTypeId, sourceMealTypeId),
        eq(parentMealPlansTable.date, today)
      ))
      .limit(1);

    if (!source) { res.status(404).json({ message: "Source meal not found" }); return; }

    const sourceFoods = await db
      .select()
      .from(parentMealPlanFoodsTable)
      .where(eq(parentMealPlanFoodsTable.mealPlanId, source.id));

    const existingTarget = await db
      .select()
      .from(parentMealPlansTable)
      .where(and(
        eq(parentMealPlansTable.kidId, kidId),
        eq(parentMealPlansTable.mealTypeId, targetMealTypeId),
        eq(parentMealPlansTable.date, today)
      ))
      .limit(1);

    if (existingTarget.length > 0) {
      await db.delete(parentMealPlanFoodsTable).where(eq(parentMealPlanFoodsTable.mealPlanId, existingTarget[0].id));
      await db
        .update(parentMealPlansTable)
        .set({
          totalCalories: source.totalCalories,
          totalCarbs: source.totalCarbs,
          totalFat: source.totalFat,
          totalProtein: source.totalProtein,
          ateStatus: "unknown",
          portionPercent: null,
          status: "planned",
          updatedAt: new Date(),
        })
        .where(eq(parentMealPlansTable.id, existingTarget[0].id));

      for (const sf of sourceFoods) {
        await db.insert(parentMealPlanFoodsTable).values({
          mealPlanId: existingTarget[0].id,
          foodId: sf.foodId,
          sortOrder: sf.sortOrder,
        });
      }

      res.json({ mealPlanId: existingTarget[0].id });
      return;
    }

    const [newPlan] = await db
      .insert(parentMealPlansTable)
      .values({
        kidId,
        mealTypeId: targetMealTypeId,
        date: today,
        totalCalories: source.totalCalories,
        totalCarbs: source.totalCarbs,
        totalFat: source.totalFat,
        totalProtein: source.totalProtein,
      })
      .returning();

    for (const sf of sourceFoods) {
      await db.insert(parentMealPlanFoodsTable).values({
        mealPlanId: newPlan.id,
        foodId: sf.foodId,
        sortOrder: sf.sortOrder,
      });
    }

    res.json({ mealPlanId: newPlan.id });
  } catch (err) {
    req.log?.error({ err }, "Copy meal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/meal-plans/:id/eat-status", async (req: Request, res: Response) => {
  try {
    const mealPlanId = Number(req.params.id);
    const kidId = req.session.parentKidId!;
    const { ateStatus, portionPercent } = req.body;

    if (!["yes", "no"].includes(ateStatus)) {
      res.status(400).json({ message: "ateStatus must be yes or no" });
      return;
    }

    const [plan] = await db
      .select()
      .from(parentMealPlansTable)
      .where(and(eq(parentMealPlansTable.id, mealPlanId), eq(parentMealPlansTable.kidId, kidId)))
      .limit(1);

    if (!plan) { res.status(404).json({ message: "Meal plan not found" }); return; }

    await db
      .update(parentMealPlansTable)
      .set({
        ateStatus,
        portionPercent: ateStatus === "yes" ? (portionPercent ?? 100) : 0,
        status: ateStatus === "yes" ? "consumed" : "not_involved",
        updatedAt: new Date(),
      })
      .where(eq(parentMealPlansTable.id, mealPlanId));

    res.status(204).send();
  } catch (err) {
    req.log?.error({ err }, "Update eat status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    const kidId = req.session.parentKidId!;
    const days = Number(req.query.days) || 7;

    const [settings] = await db
      .select()
      .from(medicalSettingsTable)
      .where(eq(medicalSettingsTable.kidId, kidId))
      .limit(1);

    const mealTypes = await db
      .select()
      .from(mealTypesTable)
      .orderBy(asc(mealTypesTable.id));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const plans = await db
      .select()
      .from(parentMealPlansTable)
      .where(and(
        eq(parentMealPlansTable.kidId, kidId),
        sql`${parentMealPlansTable.date} >= ${startDateStr}`
      ))
      .orderBy(desc(parentMealPlansTable.date));

    const dayMap = new Map<string, typeof plans>();
    for (const p of plans) {
      const d = p.date;
      if (!dayMap.has(d)) dayMap.set(d, []);
      dayMap.get(d)!.push(p);
    }

    const carbsTarget = settings?.dailyCarbs || 20;
    const fatTarget = settings?.dailyFat || 100;
    const proteinTarget = settings?.dailyProtein || 40;
    const caloriesTarget = settings?.dailyCalories || 1200;

    const result = [];
    for (const [date, dayPlans] of dayMap) {
      let carbsConsumed = 0, fatConsumed = 0, proteinConsumed = 0, caloriesConsumed = 0;

      const meals = mealTypes.map((mt) => {
        const plan = dayPlans.find((p) => p.mealTypeId === mt.id);
        let status = "empty";
        if (plan) {
          if (plan.ateStatus === "yes") {
            status = "consumed";
            const pct = (plan.portionPercent ?? 100) / 100;
            carbsConsumed += (plan.totalCarbs ?? 0) * pct;
            fatConsumed += (plan.totalFat ?? 0) * pct;
            proteinConsumed += (plan.totalProtein ?? 0) * pct;
            caloriesConsumed += (plan.totalCalories ?? 0) * pct;
          } else if (plan.ateStatus === "no") {
            status = "not_involved";
          } else {
            status = "planned";
          }
        }
        return {
          mealTypeId: mt.id,
          mealTypeName: mt.name,
          status,
          mealPlanId: plan?.id || null,
          foods: [],
          ateStatus: plan?.ateStatus || "unknown",
          portionPercent: plan?.portionPercent ?? null,
        };
      });

      result.push({
        date,
        meals,
        dailyProgress: {
          carbsConsumed: Math.round(carbsConsumed * 10) / 10,
          carbsTarget,
          fatConsumed: Math.round(fatConsumed * 10) / 10,
          fatTarget,
          proteinConsumed: Math.round(proteinConsumed * 10) / 10,
          proteinTarget,
          caloriesConsumed: Math.round(caloriesConsumed * 10) / 10,
          caloriesTarget,
        },
      });
    }

    res.json(result);
  } catch (err) {
    req.log?.error({ err }, "History error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
