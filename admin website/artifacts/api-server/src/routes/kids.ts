import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  kidsTable,
  medicalSettingsTable,
  weightRecordsTable,
  mealDaysTable,
  notesTable,
  ketoneReadingsTable,
  mealLogsTable,
  mealPlansTable,
  mealPlanItemsTable,
  mealEntriesTable,
  libraryMealPlansTable,
  libraryMealPlanItemsTable,
  mealPlanAssignmentHistoryTable,
  sideEffectsTable,
  kidSideEffectsTable,
} from "@workspace/db";
import { eq, and, desc, asc, gte, sql, inArray } from "drizzle-orm";
import { calcAgeMonths } from "../lib/utils";
import {
  CreateKidBody,
  UpdateKidBody,
  AddWeightRecordBody,
  UpdateKidMedicalBody,
  AddKidNoteBody,
  UpdateFoodVisibilityBody,
  GetKidsQueryParams,
  GetKidMealHistoryQueryParams,
  AddKetoneReadingBody,
  GetKidKetoneReadingsQueryParams,
  AddMealLogBody,
  GetKidMealLogsQueryParams,
  CreateKidMealPlanBody,
  UpdateKidMealPlanBody,
  AddMealPlanItemBody,
  AssignKidMealPlanBody,
  UpdateMealLogImageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PHN_FORMAT_REGEX = /^\d{4}-\d{6}-\d$/;

async function getKidSideEffects(kidId: number): Promise<{ hasSideEffects: boolean; sideEffectNames: string[] }> {
  const rows = await db
    .select({
      sideEffectId: kidSideEffectsTable.sideEffectId,
      customName: kidSideEffectsTable.customName,
      name: sideEffectsTable.name,
    })
    .from(kidSideEffectsTable)
    .leftJoin(sideEffectsTable, eq(kidSideEffectsTable.sideEffectId, sideEffectsTable.id))
    .where(eq(kidSideEffectsTable.kidId, kidId));

  const names = rows.map((r) => r.customName ?? r.name ?? "Unknown");
  return { hasSideEffects: names.length > 0, sideEffectNames: names };
}

async function getKidCompletionRate(kidId: number): Promise<number> {
  const mealDays = await db.select().from(mealDaysTable).where(eq(mealDaysTable.kidId, kidId));
  if (mealDays.length === 0) return 1;
  const filled = mealDays.filter((m) => m.isFilled).length;
  return filled / mealDays.length;
}

async function getKidCurrentWeight(kidId: number): Promise<{ weight: number | null; date: string | null }> {
  const [latest] = await db
    .select()
    .from(weightRecordsTable)
    .where(eq(weightRecordsTable.kidId, kidId))
    .orderBy(desc(weightRecordsTable.date))
    .limit(1);
  return { weight: latest?.weight ?? null, date: latest?.date ?? null };
}

async function getKidKetoStatus(kidId: number): Promise<boolean> {
  const recentMeals = await db
    .select()
    .from(mealDaysTable)
    .where(eq(mealDaysTable.kidId, kidId))
    .orderBy(desc(mealDaysTable.date))
    .limit(7);

  if (recentMeals.length === 0) return false;

  const avgCarbs = recentMeals.reduce((sum, m) => sum + (m.totalCarbs ?? 0), 0) / recentMeals.length;

  const [medical] = await db
    .select()
    .from(medicalSettingsTable)
    .where(eq(medicalSettingsTable.kidId, kidId))
    .limit(1);

  const targetCarbs = medical?.dailyCarbs ?? 20;
  return avgCarbs <= targetCarbs;
}

async function getLast24hCompletionRate(kidId: number): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const logs = await db
    .select()
    .from(mealLogsTable)
    .where(and(eq(mealLogsTable.kidId, kidId), gte(mealLogsTable.createdAt, cutoff)));

  if (logs.length === 0) return 0;
  const completed = logs.filter(l => l.isCompleted).length;
  return completed / logs.length;
}

async function resolveOwnedKid(kidId: number, doctorId: number, isPrivileged: boolean) {
  const whereClause = isPrivileged
    ? eq(kidsTable.id, kidId)
    : and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId));
  const [kid] = await db
    .select()
    .from(kidsTable)
    .where(whereClause)
    .limit(1);
  return kid ?? null;
}

router.param("kidId", async (req, res, next, kidIdStr) => {
  const kidId = parseInt(kidIdStr);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }
  const doctorId = req.session.doctorId!;
  const isPrivileged = req.session.doctorRole === "moderator" || req.session.doctorRole === "admin";
  const kid = await resolveOwnedKid(kidId, doctorId, isPrivileged);
  if (!kid) {
    res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
    return;
  }
  next();
});

router.get("/", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isPrivileged = req.session.doctorRole === "moderator" || req.session.doctorRole === "admin";

  const rawDietType = req.query.dietType;
  const dietTypeArray = rawDietType
    ? (Array.isArray(rawDietType) ? rawDietType : [rawDietType]).filter((v) => ["classic", "mad", "mct", "lowgi"].includes(String(v))) as string[]
    : undefined;

  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const sideEffectsFilter = req.query.hasSideEffects !== undefined ? req.query.hasSideEffects === "true" : undefined;
  const ketoStatus = req.query.ketoStatus !== undefined ? req.query.ketoStatus === "true" : undefined;

  try {
    let kidsQuery = db.select().from(kidsTable).$dynamic();

    const conditions = isPrivileged ? [] : [eq(kidsTable.doctorId, doctorId)];
    if (dietTypeArray && dietTypeArray.length > 0) {
      conditions.push(inArray(kidsTable.dietType, dietTypeArray));
    }
    if (conditions.length > 0) {
      kidsQuery = kidsQuery.where(and(...conditions));
    }

    const kids = await kidsQuery.orderBy(asc(kidsTable.name));

    const enriched = await Promise.all(
      kids.map(async (kid) => {
        const nameMatch = search ? kid.name.toLowerCase().includes(search.toLowerCase()) : true;
        const codeMatch = search ? kid.kidCode.toLowerCase().includes(search.toLowerCase()) : true;
        const parentMatch = search ? kid.parentName.toLowerCase().includes(search.toLowerCase()) : true;
        const dobMatch = search ? kid.dateOfBirth.includes(search) : true;
        if (search && !nameMatch && !codeMatch && !parentMatch && !dobMatch) return null;

        const [completionRate, { weight, date }, inKetoStatus, last24hCompletionRate, { hasSideEffects, sideEffectNames }] = await Promise.all([
          getKidCompletionRate(kid.id),
          getKidCurrentWeight(kid.id),
          getKidKetoStatus(kid.id),
          getLast24hCompletionRate(kid.id),
          getKidSideEffects(kid.id),
        ]);

        if (sideEffectsFilter !== undefined && hasSideEffects !== sideEffectsFilter) return null;
        if (ketoStatus !== undefined && inKetoStatus !== ketoStatus) return null;

        return {
          id: kid.id,
          name: kid.name,
          kidCode: kid.kidCode,
          dateOfBirth: kid.dateOfBirth,
          ageMonths: calcAgeMonths(kid.dateOfBirth),
          dietType: kid.dietType,
          dietSubCategory: kid.dietSubCategory,
          parentName: kid.parentName,
          parentContact: kid.parentContact,
          hasSideEffects,
          sideEffectNames,
          mealCompletionRate: completionRate,
          inKetoStatus,
          last24hCompletionRate,
          currentWeight: weight,
          lastWeightDate: date,
          gender: kid.gender,
        };
      })
    );

    res.json(enriched.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Get kids error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  // zod.date() requires a Date object; JSON bodies send strings — coerce dateOfBirth before parsing
  const rawBody = req.body as Record<string, unknown>;
  const bodyToParse = {
    ...rawBody,
    dateOfBirth:
      typeof rawBody.dateOfBirth === "string"
        ? new Date(rawBody.dateOfBirth)
        : rawBody.dateOfBirth,
  };
  const parsed = CreateKidBody.safeParse(bodyToParse);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid request body" });
    return;
  }

  const { kidCode } = parsed.data;
  if (!PHN_FORMAT_REGEX.test(kidCode)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "PHN must be in the format XXXX-XXXXXX-X (e.g. 0180-498827-2)" });
    return;
  }

  const existingPHN = await db.select({ id: kidsTable.id }).from(kidsTable).where(eq(kidsTable.kidCode, kidCode));
  if (existingPHN.length > 0) {
    res.status(409).json({ error: "DUPLICATE_PHN", message: `PHN ${kidCode} is already in use. Please enter a different PHN.` });
    return;
  }

  try {
    const sessionDoctorId = req.session?.doctorId ?? null;
    const { dateOfBirth, ...rest } = parsed.data;
    const dobString = dateOfBirth.toISOString().split("T")[0];
    let kid: typeof kidsTable.$inferSelect | undefined;
    try {
      [kid] = await db
        .insert(kidsTable)
        .values({
          ...rest,
          dateOfBirth: dobString,
          doctorId: sessionDoctorId,
        })
        .returning();
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") {
        res.status(409).json({ error: "DUPLICATE_PHN", message: `PHN ${kidCode} is already in use. Please enter a different PHN.` });
        return;
      }
      throw err;
    }
    if (!kid) throw new Error("Failed to insert kid record");

    const effectiveSubCategory = parsed.data.dietType === "classic" ? (parsed.data.dietSubCategory ?? null) : null;

    await db.insert(medicalSettingsTable).values({
      kidId: kid.id,
      dietType: parsed.data.dietType,
      dietSubCategory: effectiveSubCategory,
      ketoRatio: 3,
      dailyCalories: 1200,
      dailyCarbs: 20,
      dailyFat: 100,
      dailyProtein: 40,
      showAllFoods: true,
      showAllRecipes: true,
    });

    res.status(201).json({
      id: kid.id,
      name: kid.name,
      kidCode: kid.kidCode,
      dateOfBirth: kid.dateOfBirth,
      ageMonths: calcAgeMonths(kid.dateOfBirth),
      dietType: kid.dietType,
      dietSubCategory: kid.dietSubCategory,
      parentName: kid.parentName,
      parentContact: kid.parentContact,
      hasSideEffects: false,
      mealCompletionRate: 1,
      currentWeight: null,
      lastWeightDate: null,
      gender: kid.gender,
    });
  } catch (err) {
    req.log.error({ err }, "Create kid error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isPrivileged = req.session.doctorRole === "moderator" || req.session.doctorRole === "admin";
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  try {
    const kidWhereClause = isPrivileged
      ? eq(kidsTable.id, kidId)
      : and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId));
    const [kid] = await db
      .select()
      .from(kidsTable)
      .where(kidWhereClause)
      .limit(1);
    if (!kid) {
      res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
      return;
    }

    const [medical] = await db
      .select()
      .from(medicalSettingsTable)
      .where(eq(medicalSettingsTable.kidId, kidId))
      .limit(1);

    const recentWeights = await db
      .select()
      .from(weightRecordsTable)
      .where(eq(weightRecordsTable.kidId, kidId))
      .orderBy(asc(weightRecordsTable.date))
      .limit(30);

    const recentMeals = await db
      .select()
      .from(mealDaysTable)
      .where(eq(mealDaysTable.kidId, kidId))
      .orderBy(desc(mealDaysTable.date))
      .limit(30);

    const notes = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.kidId, kidId))
      .orderBy(desc(notesTable.createdAt));

    const [completionRate, { weight, date }, inKetoStatus, last24hCompletionRate, { hasSideEffects, sideEffectNames }] = await Promise.all([
      getKidCompletionRate(kidId),
      getKidCurrentWeight(kidId),
      getKidKetoStatus(kidId),
      getLast24hCompletionRate(kidId),
      getKidSideEffects(kidId),
    ]);

    const medicalData = medical || {
      id: 0,
      kidId,
      dietType: kid.dietType,
      dietSubCategory: kid.dietSubCategory,
      ketoRatio: 3,
      dailyCalories: 1200,
      dailyCarbs: 20,
      dailyFat: 100,
      dailyProtein: 40,
      showAllFoods: true,
      showAllRecipes: true,
    };

    res.json({
      kid: {
        id: kid.id,
        name: kid.name,
        kidCode: kid.kidCode,
        dateOfBirth: kid.dateOfBirth,
        ageMonths: calcAgeMonths(kid.dateOfBirth),
        dietType: kid.dietType,
        dietSubCategory: kid.dietSubCategory,
        parentName: kid.parentName,
        parentContact: kid.parentContact,
        hasSideEffects,
        sideEffectNames,
        mealCompletionRate: completionRate,
        inKetoStatus,
        last24hCompletionRate,
        currentWeight: weight,
        lastWeightDate: date,
        gender: kid.gender,
      },
      medical: medicalData,
      recentWeights: recentWeights.map((w) => ({
        id: w.id,
        kidId: w.kidId,
        weight: w.weight,
        date: w.date,
        note: w.note,
      })),
      recentMeals: recentMeals.map((m) => ({
        date: m.date,
        completionRate: m.totalMeals > 0 ? m.completedMeals / m.totalMeals : 0,
        totalMeals: m.totalMeals,
        completedMeals: m.completedMeals,
        missedMeals: m.missedMeals,
        isFilled: m.isFilled,
        totalCalories: m.totalCalories,
        totalCarbs: m.totalCarbs,
        totalFat: m.totalFat,
        totalProtein: m.totalProtein,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        kidId: n.kidId,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
        doctorName: n.doctorName,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get kid profile error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:kidId", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  const rawBody = req.body as Record<string, unknown>;
  const bodyToParse = {
    ...rawBody,
    dateOfBirth:
      typeof rawBody.dateOfBirth === "string"
        ? new Date(rawBody.dateOfBirth)
        : rawBody.dateOfBirth,
  };
  const parsed = UpdateKidBody.safeParse(bodyToParse);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid request body" });
    return;
  }

  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";
  try {
    const { dateOfBirth, ...restData } = parsed.data;
    const updateData = dateOfBirth
      ? { ...restData, dateOfBirth: dateOfBirth.toISOString().split("T")[0] }
      : restData;
    const updateWhere = isAdmin
      ? eq(kidsTable.id, kidId)
      : and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId));
    const [kid] = await db
      .update(kidsTable)
      .set(updateData)
      .where(updateWhere)
      .returning();

    if (!kid) {
      res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
      return;
    }

    const [completionRate, { weight, date }, inKetoStatus, last24hCompletionRate, { hasSideEffects, sideEffectNames }] = await Promise.all([
      getKidCompletionRate(kidId),
      getKidCurrentWeight(kidId),
      getKidKetoStatus(kidId),
      getLast24hCompletionRate(kidId),
      getKidSideEffects(kidId),
    ]);

    res.json({
      id: kid.id,
      name: kid.name,
      kidCode: kid.kidCode,
      dateOfBirth: kid.dateOfBirth,
      ageMonths: calcAgeMonths(kid.dateOfBirth),
      dietType: kid.dietType,
      dietSubCategory: kid.dietSubCategory,
      parentName: kid.parentName,
      parentContact: kid.parentContact,
      hasSideEffects,
      sideEffectNames,
      mealCompletionRate: completionRate,
      inKetoStatus,
      last24hCompletionRate,
      currentWeight: weight,
      lastWeightDate: date,
      gender: kid.gender,
    });
  } catch (err) {
    req.log.error({ err }, "Update kid error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:kidId", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";
  try {
    await db.transaction(async (tx) => {
      await tx.delete(ketoneReadingsTable).where(eq(ketoneReadingsTable.kidId, kidId));
      await tx.delete(notesTable).where(eq(notesTable.kidId, kidId));
      await tx.delete(weightRecordsTable).where(eq(weightRecordsTable.kidId, kidId));
      await tx.delete(mealEntriesTable).where(eq(mealEntriesTable.kidId, kidId));

      const kidMealPlans = await tx.select().from(mealPlansTable).where(eq(mealPlansTable.kidId, kidId));
      for (const plan of kidMealPlans) {
        await tx.delete(mealPlanItemsTable).where(eq(mealPlanItemsTable.planId, plan.id));
      }
      await tx.delete(mealPlansTable).where(eq(mealPlansTable.kidId, kidId));

      await tx.delete(mealLogsTable).where(eq(mealLogsTable.kidId, kidId));
      await tx.delete(mealDaysTable).where(eq(mealDaysTable.kidId, kidId));
      await tx.delete(medicalSettingsTable).where(eq(medicalSettingsTable.kidId, kidId));
      const deleteWhere = isAdmin
        ? eq(kidsTable.id, kidId)
        : and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId));
      const deleted = await tx.delete(kidsTable).where(deleteWhere).returning({ id: kidsTable.id });
      if (deleted.length === 0) {
        throw new Error("NOT_FOUND");
      }
    });

    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
      return;
    }
    req.log.error({ err }, "Delete kid error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/:kidId/weight", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  const bodyWithDate = {
    ...req.body,
    date: req.body.date ? new Date(req.body.date) : undefined,
  };
  const parsed = AddWeightRecordBody.safeParse(bodyWithDate);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid request body" });
    return;
  }

  const dateStr = parsed.data.date instanceof Date
    ? parsed.data.date.toISOString().split("T")[0]
    : String(parsed.data.date);

  try {
    const { record, macrosRecalculated } = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(weightRecordsTable)
        .values({ kidId, weight: parsed.data.weight, date: dateStr, note: parsed.data.note })
        .returning();

      const [medical] = await tx
        .select()
        .from(medicalSettingsTable)
        .where(eq(medicalSettingsTable.kidId, kidId))
        .limit(1);

      if (!medical) {
        return { record, macrosRecalculated: false };
      }

      const weightKg = parsed.data.weight;
      const ketoRatio = medical.ketoRatio;

      // Weight-tiered pediatric calorie formula:
      // First 10 kg → 110 kcal/kg, next 10 kg → 70 kcal/kg, remainder → 30 kcal/kg
      let dailyCalories: number;
      if (weightKg <= 10) {
        dailyCalories = Math.round(110 * weightKg);
      } else if (weightKg <= 20) {
        dailyCalories = Math.round(110 * 10 + 70 * (weightKg - 10));
      } else {
        dailyCalories = Math.round(110 * 10 + 70 * 10 + 30 * (weightKg - 20));
      }

      const protein = Math.round(weightKg * 1);
      const energyPerUnit = ketoRatio * 9 + 4;
      const dietaryUnits = energyPerUnit > 0 ? dailyCalories / energyPerUnit : 0;
      const carbs = Math.max(0, Math.round(dietaryUnits - protein));
      const fat = Math.round(dietaryUnits * ketoRatio);

      await tx
        .update(medicalSettingsTable)
        .set({ dailyCalories, dailyProtein: protein, dailyCarbs: carbs, dailyFat: fat, updatedAt: new Date() })
        .where(eq(medicalSettingsTable.kidId, kidId));

      return { record, macrosRecalculated: true };
    });

    res.status(201).json({
      id: record.id,
      kidId: record.kidId,
      weight: record.weight,
      date: record.date,
      note: record.note,
      macrosRecalculated,
    });
  } catch (err) {
    req.log.error({ err }, "Add weight error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:kidId/weight/:recordId", async (req, res) => {
  const kidId = parseInt(req.params.kidId, 10);
  const recordId = parseInt(req.params.recordId, 10);
  if (isNaN(kidId) || isNaN(recordId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID or record ID" });
    return;
  }

  try {
    await db
      .delete(weightRecordsTable)
      .where(and(eq(weightRecordsTable.id, recordId), eq(weightRecordsTable.kidId, kidId)));

    res.json({ success: true, message: "Weight record deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete weight record error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/weight", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  try {
    const weights = await db
      .select()
      .from(weightRecordsTable)
      .where(eq(weightRecordsTable.kidId, kidId))
      .orderBy(asc(weightRecordsTable.date));

    res.json(
      weights.map((w) => ({
        id: w.id,
        kidId: w.kidId,
        weight: w.weight,
        date: w.date,
        note: w.note,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get weight history error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/medical", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  try {
    const [medical] = await db
      .select()
      .from(medicalSettingsTable)
      .where(eq(medicalSettingsTable.kidId, kidId))
      .limit(1);

    if (!medical) {
      res.status(404).json({ error: "NOT_FOUND", message: "Medical settings not found" });
      return;
    }

    res.json(medical);
  } catch (err) {
    req.log.error({ err }, "Get medical settings error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:kidId/medical", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  const parsed = UpdateKidMedicalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid request body" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(medicalSettingsTable)
      .where(eq(medicalSettingsTable.kidId, kidId))
      .limit(1);

    let medical;
    if (existing.length === 0) {
      [medical] = await db
        .insert(medicalSettingsTable)
        .values({ kidId, ...parsed.data } as typeof medicalSettingsTable.$inferInsert)
        .returning();
    } else {
      [medical] = await db
        .update(medicalSettingsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(medicalSettingsTable.kidId, kidId))
        .returning();
    }

    if (parsed.data.dietType) {
      const effectiveSubCategory = parsed.data.dietType === "classic" ? (parsed.data.dietSubCategory ?? null) : null;
      await db.update(kidsTable).set({ dietType: parsed.data.dietType, dietSubCategory: effectiveSubCategory }).where(eq(kidsTable.id, kidId));
    }

    res.json(medical);
  } catch (err) {
    req.log.error({ err }, "Update medical settings error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/meal-history", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  const query = GetKidMealHistoryQueryParams.safeParse(req.query);
  const limit = query.success ? query.data.limit ?? 30 : 30;

  try {
    const meals = await db
      .select()
      .from(mealDaysTable)
      .where(eq(mealDaysTable.kidId, kidId))
      .orderBy(desc(mealDaysTable.date))
      .limit(limit);

    res.json(
      meals.map((m) => ({
        date: m.date,
        completionRate: m.totalMeals > 0 ? m.completedMeals / m.totalMeals : 0,
        totalMeals: m.totalMeals,
        completedMeals: m.completedMeals,
        missedMeals: m.missedMeals,
        isFilled: m.isFilled,
        totalCalories: m.totalCalories,
        totalCarbs: m.totalCarbs,
        totalFat: m.totalFat,
        totalProtein: m.totalProtein,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get meal history error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/notes", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  try {
    const notes = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.kidId, kidId))
      .orderBy(desc(notesTable.createdAt));

    res.json(
      notes.map((n) => ({
        id: n.id,
        kidId: n.kidId,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
        doctorName: n.doctorName,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get notes error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/:kidId/notes", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  const parsed = AddKidNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid request body" });
    return;
  }

  const doctorName = req.session.doctorName ?? "Doctor";
  const doctorId = req.session.doctorId;

  try {
    const [note] = await db
      .insert(notesTable)
      .values({ kidId, content: parsed.data.content, doctorName, doctorId })
      .returning();

    res.status(201).json({
      id: note.id,
      kidId: note.kidId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      doctorName: note.doctorName,
    });
  } catch (err) {
    req.log.error({ err }, "Add note error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:kidId/notes/:noteId", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  const noteId = parseInt(req.params.noteId);
  if (isNaN(kidId) || isNaN(noteId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid ID" });
    return;
  }

  try {
    await db
      .delete(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.kidId, kidId)));

    res.json({ success: true, message: "Note deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete note error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:kidId/visibility", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  const parsed = UpdateFoodVisibilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid request body" });
    return;
  }

  try {
    await db
      .update(medicalSettingsTable)
      .set({
        showAllFoods: parsed.data.showAllFoods,
        showAllRecipes: parsed.data.showAllRecipes,
        updatedAt: new Date(),
      })
      .where(eq(medicalSettingsTable.kidId, kidId));

    res.json({ success: true, message: "Visibility updated" });
  } catch (err) {
    req.log.error({ err }, "Update visibility error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// GET /kids/:kidId/meal-logs
router.get("/:kidId/meal-logs", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const params = GetKidMealLogsQueryParams.safeParse({
      ...req.query,
      date: req.query.date ? new Date(req.query.date as string) : undefined,
    });
    const limit = params.success ? params.data.limit : 50;
    const filterDate = params.success ? params.data.date : undefined;

    const results = await db
      .select()
      .from(mealLogsTable)
      .where(
        filterDate
          ? and(eq(mealLogsTable.kidId, kidId), eq(mealLogsTable.date, filterDate.toISOString().split("T")[0]))
          : eq(mealLogsTable.kidId, kidId)
      )
      .orderBy(desc(mealLogsTable.date), asc(mealLogsTable.mealType))
      .limit(limit);

    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Get meal logs error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// POST /kids/:kidId/meal-logs
router.post("/:kidId/meal-logs", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const parsed = AddMealLogBody.safeParse({
      ...req.body,
      date: req.body.date ? new Date(req.body.date) : undefined,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }

    const [log] = await db
      .insert(mealLogsTable)
      .values({
        kidId,
        date: parsed.data.date.toISOString().split("T")[0],
        mealType: parsed.data.mealType,
        isCompleted: parsed.data.isCompleted ?? true,
        calories: parsed.data.calories,
        carbs: parsed.data.carbs,
        fat: parsed.data.fat,
        protein: parsed.data.protein,
        notes: parsed.data.notes,
      })
      .returning();

    res.status(201).json(log);
  } catch (err) {
    req.log.error({ err }, "Add meal log error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// DELETE /kids/:kidId/meal-logs/:logId
router.delete("/:kidId/meal-logs/:logId", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const logId = parseInt(req.params.logId, 10);

    await db
      .delete(mealLogsTable)
      .where(and(eq(mealLogsTable.id, logId), eq(mealLogsTable.kidId, kidId)));

    res.json({ success: true, message: "Meal log deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete meal log error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// GET /kids/:kidId/ketones
router.get("/:kidId/ketones", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const parsed = GetKidKetoneReadingsQueryParams.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : 30;

    const readings = await db
      .select()
      .from(ketoneReadingsTable)
      .where(eq(ketoneReadingsTable.kidId, kidId))
      .orderBy(desc(ketoneReadingsTable.date))
      .limit(limit);

    res.json(readings);
  } catch (err) {
    req.log.error({ err }, "Get ketone readings error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// GET /kids/:kidId/meal-log?date=YYYY-MM-DD (per-food entries grouped by meal type)
router.get("/:kidId/meal-log", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    if (isNaN(kidId) || kidId <= 0) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kidId" });
      return;
    }

    const dateStr = req.query.date as string | undefined;
    if (!dateStr) {
      res.status(400).json({ error: "BAD_REQUEST", message: "date query param required" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(Date.parse(dateStr))) {
      res.status(400).json({ error: "BAD_REQUEST", message: "date must be in YYYY-MM-DD format" });
      return;
    }

    const entries = await db
      .select()
      .from(mealEntriesTable)
      .where(and(eq(mealEntriesTable.kidId, kidId), eq(mealEntriesTable.date, dateStr)))
      .orderBy(asc(mealEntriesTable.mealType), asc(mealEntriesTable.createdAt));

    const grouped: Record<string, typeof entries> = {};

    for (const entry of entries) {
      const slot = entry.mealType;
      if (!grouped[slot]) grouped[slot] = [];
      grouped[slot].push(entry);
    }

    const toDto = (e: (typeof entries)[number]) => ({
      id: e.id,
      kidId: e.kidId,
      date: e.date,
      mealType: e.mealType,
      foodName: e.foodName,
      quantity: e.quantity,
      unit: e.unit,
      calories: e.calories,
      carbs: e.carbs,
      fat: e.fat,
      protein: e.protein,
    });

    const meals: Record<string, ReturnType<typeof toDto>[]> = {};
    for (const [slot, items] of Object.entries(grouped)) {
      meals[slot] = items.map(toDto);
    }

    res.json({
      date: dateStr,
      meals,
    });
  } catch (err) {
    req.log.error({ err }, "Get meal log detail error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// POST /kids/:kidId/ketones
router.post("/:kidId/ketones", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const parsed = AddKetoneReadingBody.safeParse({
      ...req.body,
      date: req.body.date ? new Date(req.body.date) : undefined,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Invalid input" });
      return;
    }

    const [reading] = await db
      .insert(ketoneReadingsTable)
      .values({
        kidId,
        value: parsed.data.value,
        unit: parsed.data.unit ?? "mmol/L",
        readingType: parsed.data.readingType ?? "blood",
        date: parsed.data.date.toISOString(),
        notes: parsed.data.notes,
      })
      .returning();

    res.status(201).json(reading);
  } catch (err) {
    req.log.error({ err }, "Add ketone reading error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// DELETE /kids/:kidId/ketones/:readingId
router.delete("/:kidId/ketones/:readingId", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const readingId = parseInt(req.params.readingId, 10);

    await db
      .delete(ketoneReadingsTable)
      .where(and(eq(ketoneReadingsTable.id, readingId), eq(ketoneReadingsTable.kidId, kidId)));

    res.json({ success: true, message: "Reading deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete ketone reading error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});



router.get("/:kidId/meal-plans", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const plans = await db
      .select()
      .from(mealPlansTable)
      .where(eq(mealPlansTable.kidId, kidId))
      .orderBy(desc(mealPlansTable.createdAt));
    res.json(plans);
  } catch (err) {
    req.log.error({ err }, "Get meal plans error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/:kidId/meal-plans", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const parsed = CreateKidMealPlanBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }

    if (parsed.data.isActive) {
      await db
        .update(mealPlansTable)
        .set({ isActive: false })
        .where(eq(mealPlansTable.kidId, kidId));
    }

    const [plan] = await db
      .insert(mealPlansTable)
      .values({ kidId, name: parsed.data.name, description: parsed.data.description ?? "", isActive: parsed.data.isActive ?? true })
      .returning();

    res.status(201).json(plan);
  } catch (err) {
    req.log.error({ err }, "Create meal plan error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/meal-plans/:planId", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const planId = parseInt(req.params.planId, 10);

    const [plan] = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.kidId, kidId)))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: "NOT_FOUND", message: "Meal plan not found" });
      return;
    }

    const items = await db
      .select()
      .from(mealPlanItemsTable)
      .where(eq(mealPlanItemsTable.planId, planId))
      .orderBy(asc(mealPlanItemsTable.mealType));

    res.json({ ...plan, items });
  } catch (err) {
    req.log.error({ err }, "Get meal plan error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:kidId/meal-plans/:planId", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const planId = parseInt(req.params.planId, 10);
    const parsed = UpdateKidMealPlanBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }

    if (parsed.data.isActive) {
      await db
        .update(mealPlansTable)
        .set({ isActive: false })
        .where(and(eq(mealPlansTable.kidId, kidId), eq(mealPlansTable.isActive, true)));
    }

    const [plan] = await db
      .update(mealPlansTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.kidId, kidId)))
      .returning();

    if (!plan) {
      res.status(404).json({ error: "NOT_FOUND", message: "Meal plan not found" });
      return;
    }

    res.json(plan);
  } catch (err) {
    req.log.error({ err }, "Update meal plan error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:kidId/meal-plans/:planId", async (req, res) => {
  try {
    const kidId = parseInt(req.params.kidId, 10);
    const planId = parseInt(req.params.planId, 10);

    await db.delete(mealPlanItemsTable).where(eq(mealPlanItemsTable.planId, planId));
    await db.delete(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.kidId, kidId)));

    res.json({ success: true, message: "Meal plan deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete meal plan error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/:kidId/meal-plans/:planId/items", async (req, res) => {
  try {
    const planId = parseInt(req.params.planId, 10);
    const parsed = AddMealPlanItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }

    const [item] = await db
      .insert(mealPlanItemsTable)
      .values({
        planId,
        mealType: parsed.data.mealType,
        foodId: parsed.data.foodId,
        foodName: parsed.data.foodName,
        portionGrams: parsed.data.portionGrams,
        calories: parsed.data.calories ?? 0,
        carbs: parsed.data.carbs ?? 0,
        fat: parsed.data.fat ?? 0,
        protein: parsed.data.protein ?? 0,
        notes: parsed.data.notes ?? "",
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Add meal plan item error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:kidId/meal-plans/:planId/items/:itemId", async (req, res) => {
  try {
    const planId = parseInt(req.params.planId, 10);
    const itemId = parseInt(req.params.itemId, 10);

    await db
      .delete(mealPlanItemsTable)
      .where(and(eq(mealPlanItemsTable.id, itemId), eq(mealPlanItemsTable.planId, planId)));

    res.json({ success: true, message: "Item removed" });
  } catch (err) {
    req.log.error({ err }, "Delete meal plan item error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/meal-plan", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isPrivileged = req.session.doctorRole === "moderator" || req.session.doctorRole === "admin";
  const kidId = parseInt(req.params.kidId, 10);
  try {
    const kidWhere = isPrivileged
      ? eq(kidsTable.id, kidId)
      : and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId));
    const [kid] = await db
      .select({ currentMealPlanId: kidsTable.currentMealPlanId })
      .from(kidsTable)
      .where(kidWhere)
      .limit(1);

    if (!kid) {
      res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
      return;
    }

    if (!kid.currentMealPlanId) {
      res.status(204).send();
      return;
    }

    const [plan] = await db
      .select()
      .from(libraryMealPlansTable)
      .where(eq(libraryMealPlansTable.id, kid.currentMealPlanId))
      .limit(1);

    if (!plan) {
      res.status(204).send();
      return;
    }

    // Defense-in-depth: ensure the assigned plan belongs to the same doctor (skip for privileged roles)
    if (!isPrivileged && plan.doctorId !== doctorId) {
      res.status(403).json({ error: "FORBIDDEN", message: "Plan access denied" });
      return;
    }

    const items = await db
      .select()
      .from(libraryMealPlanItemsTable)
      .where(eq(libraryMealPlanItemsTable.planId, plan.id))
      .orderBy(asc(libraryMealPlanItemsTable.mealType));

    res.json({ ...plan, items });
  } catch (err) {
    req.log.error({ err }, "Get assigned meal plan error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:kidId/meal-plan", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const doctorName = req.session.doctorName ?? "Doctor";
  const isAdmin = req.session.doctorRole === "admin";
  const kidId = parseInt(req.params.kidId, 10);
  try {
    const parsed = AssignKidMealPlanBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }
    const planId = parsed.data.planId;

    let planName: string | null = null;
    if (planId !== null) {
      const planWhere = isAdmin
        ? eq(libraryMealPlansTable.id, planId)
        : and(eq(libraryMealPlansTable.id, planId), eq(libraryMealPlansTable.doctorId, doctorId));
      const [plan] = await db
        .select({ id: libraryMealPlansTable.id, name: libraryMealPlansTable.name })
        .from(libraryMealPlansTable)
        .where(planWhere)
        .limit(1);

      if (!plan) {
        res.status(404).json({ error: "NOT_FOUND", message: "Library plan not found" });
        return;
      }
      planName = plan.name;
    }

    const kidUpdateWhere = isAdmin
      ? eq(kidsTable.id, kidId)
      : and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId));

    const [existingKid] = await db
      .select({ currentMealPlanId: kidsTable.currentMealPlanId })
      .from(kidsTable)
      .where(kidUpdateWhere)
      .limit(1);

    if (!existingKid) {
      res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
      return;
    }

    const previousPlanId = existingKid.currentMealPlanId ?? null;

    if (planId === previousPlanId) {
      res.json({ success: true });
      return;
    }

    let action: string;
    if (planId === null) {
      action = "unassigned";
    } else if (previousPlanId === null) {
      action = "assigned";
    } else {
      action = "changed";
    }

    await db.transaction(async (tx) => {
      await tx
        .update(kidsTable)
        .set({ currentMealPlanId: planId })
        .where(kidUpdateWhere);

      await tx.insert(mealPlanAssignmentHistoryTable).values({
        kidId,
        planId,
        planName,
        doctorId,
        doctorName,
        action,
      });
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Assign meal plan error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/meal-plan-history", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";
  const kidId = parseInt(req.params.kidId, 10);
  try {
    const kidWhere = isAdmin
      ? eq(kidsTable.id, kidId)
      : and(eq(kidsTable.id, kidId), eq(kidsTable.doctorId, doctorId));
    const [kid] = await db.select({ id: kidsTable.id }).from(kidsTable).where(kidWhere).limit(1);
    if (!kid) {
      res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
      return;
    }

    const records = await db
      .select()
      .from(mealPlanAssignmentHistoryTable)
      .where(eq(mealPlanAssignmentHistoryTable.kidId, kidId))
      .orderBy(desc(mealPlanAssignmentHistoryTable.assignedAt));

    const now = new Date();
    const result = records.map((record, index) => {
      const startDate = new Date(record.assignedAt);
      const endDate = index === 0 ? now : new Date(records[index - 1].assignedAt);
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

      return {
        id: record.id,
        kidId: record.kidId,
        planId: record.planId,
        planName: record.planName,
        doctorId: record.doctorId,
        doctorName: record.doctorName,
        action: record.action,
        assignedAt: record.assignedAt.toISOString(),
        durationDays,
        isCurrentPeriod: index === 0,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Get meal plan history error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:kidId/meal-logs/:logId/image", async (req, res) => {
  const kidId = parseInt(req.params.kidId, 10);
  const logId = parseInt(req.params.logId, 10);
  try {
    const parsed = UpdateMealLogImageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.message });
      return;
    }

    const [updated] = await db
      .update(mealLogsTable)
      .set({ imageUrl: parsed.data.imageUrl ?? null })
      .where(and(eq(mealLogsTable.id, logId), eq(mealLogsTable.kidId, kidId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND", message: "Meal log not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update meal log image error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

// ── Side Effects ──────────────────────────────────────────────────────────────

router.get("/:kidId/side-effects", async (req, res) => {
  const kidId = parseInt(req.params.kidId, 10);
  try {
    const kidSideEffects = await db
      .select({
        id: kidSideEffectsTable.id,
        kidId: kidSideEffectsTable.kidId,
        sideEffectId: kidSideEffectsTable.sideEffectId,
        customName: kidSideEffectsTable.customName,
        name: sideEffectsTable.name,
        createdAt: kidSideEffectsTable.createdAt,
      })
      .from(kidSideEffectsTable)
      .leftJoin(sideEffectsTable, eq(kidSideEffectsTable.sideEffectId, sideEffectsTable.id))
      .where(eq(kidSideEffectsTable.kidId, kidId))
      .orderBy(asc(kidSideEffectsTable.createdAt));

    res.json(
      kidSideEffects.map((r) => ({
        id: r.id,
        kidId: r.kidId,
        sideEffectId: r.sideEffectId,
        name: r.sideEffectId ? (r.name ?? "") : (r.customName ?? ""),
        isCustom: r.sideEffectId === null,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get kid side effects error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/:kidId/side-effects", async (req, res) => {
  const kidId = parseInt(req.params.kidId, 10);
  const { sideEffectId, customName } = req.body as { sideEffectId?: number; customName?: string };

  if (!sideEffectId && !customName) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Either sideEffectId or customName is required" });
    return;
  }

  try {
    if (sideEffectId) {
      const existing = await db
        .select()
        .from(kidSideEffectsTable)
        .where(and(eq(kidSideEffectsTable.kidId, kidId), eq(kidSideEffectsTable.sideEffectId, sideEffectId)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .delete(kidSideEffectsTable)
          .where(and(eq(kidSideEffectsTable.kidId, kidId), eq(kidSideEffectsTable.sideEffectId, sideEffectId)));
        res.json({ toggled: "off", sideEffectId });
        return;
      }

      const [record] = await db
        .insert(kidSideEffectsTable)
        .values({ kidId, sideEffectId })
        .returning();
      res.status(201).json({ toggled: "on", id: record.id, sideEffectId: record.sideEffectId });
    } else {
      const trimmed = (customName as string).trim();
      if (!trimmed) {
        res.status(400).json({ error: "VALIDATION_ERROR", message: "customName cannot be empty" });
        return;
      }

      let globalEffect = await db
        .select()
        .from(sideEffectsTable)
        .where(eq(sideEffectsTable.name, trimmed))
        .limit(1);

      let effectId: number;
      if (globalEffect.length === 0) {
        const [inserted] = await db.insert(sideEffectsTable).values({ name: trimmed }).returning();
        effectId = inserted.id;
      } else {
        effectId = globalEffect[0].id;
      }

      const alreadySelected = await db
        .select()
        .from(kidSideEffectsTable)
        .where(and(eq(kidSideEffectsTable.kidId, kidId), eq(kidSideEffectsTable.sideEffectId, effectId)))
        .limit(1);

      if (alreadySelected.length > 0) {
        res.status(409).json({ error: "CONFLICT", message: "Side effect already selected for this patient" });
        return;
      }

      const [record] = await db
        .insert(kidSideEffectsTable)
        .values({ kidId, sideEffectId: effectId })
        .returning();
      res.status(201).json({ toggled: "on", id: record.id, sideEffectId: effectId, name: trimmed });
    }
  } catch (err) {
    req.log.error({ err }, "Toggle kid side effect error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/:kidId/overview", async (req, res) => {
  const kidId = parseInt(req.params.kidId);
  if (isNaN(kidId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid kid ID" });
    return;
  }

  try {
    const [kid] = await db.select().from(kidsTable).where(eq(kidsTable.id, kidId)).limit(1);
    if (!kid) {
      res.status(404).json({ error: "NOT_FOUND", message: "Kid not found" });
      return;
    }

    const [medical] = await db
      .select()
      .from(medicalSettingsTable)
      .where(eq(medicalSettingsTable.kidId, kidId))
      .limit(1);

    const weightRecords = await db
      .select()
      .from(weightRecordsTable)
      .where(eq(weightRecordsTable.kidId, kidId))
      .orderBy(asc(weightRecordsTable.date));

    const [completionRate, { hasSideEffects }] = await Promise.all([
      getKidCompletionRate(kidId),
      getKidSideEffects(kidId),
    ]);

    const firstWeight = weightRecords[0]?.weight ?? null;
    const latestWeight = weightRecords[weightRecords.length - 1]?.weight ?? null;
    const weightChange = firstWeight !== null && latestWeight !== null ? Math.round((latestWeight - firstWeight) * 10) / 10 : null;

    const [latestAssignment] = await db
      .select()
      .from(mealPlanAssignmentHistoryTable)
      .where(eq(mealPlanAssignmentHistoryTable.kidId, kidId))
      .orderBy(desc(mealPlanAssignmentHistoryTable.assignedAt))
      .limit(1);

    const dietStartDate = latestAssignment
      ? new Date(latestAssignment.assignedAt)
      : new Date(kid.createdAt);
    const daysOnCurrentDiet = Math.floor((Date.now() - dietStartDate.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      id: kid.id,
      name: kid.name,
      phn: kid.kidCode,
      dietType: kid.dietType,
      dietSubCategory: kid.dietSubCategory ?? null,
      dateOfBirth: kid.dateOfBirth,
      gender: kid.gender,
      parentName: kid.parentName,
      parentContact: kid.parentContact,
      hasSideEffects,
      mealCompletionRate: Math.round(completionRate * 100),
      ketoRatio: medical?.ketoRatio ?? null,
      dailyCalories: medical?.dailyCalories ?? null,
      weightChange,
      daysOnCurrentDiet,
      weightHistory: weightRecords.map((w) => ({ date: w.date, weight: w.weight })),
    });
  } catch (err) {
    req.log.error({ err }, "Get kid overview error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
