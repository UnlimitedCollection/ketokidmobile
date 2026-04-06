import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { kidsTable, weightRecordsTable, mealDaysTable, mealLogsTable, notesTable, doctorsTable, parentTokensTable } from "@workspace/db";
import { eq, gte, desc, inArray, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";

  try {
    const allKids = isAdmin
      ? await db.select().from(kidsTable).where(eq(kidsTable.doctorId, doctorId))
      : await db.select().from(kidsTable);

    const totalChildren = allKids.length;
    const kidIds = allKids.map((k) => k.id);

    if (kidIds.length === 0) {
      const [{ value: totalDoctors }] = await db.select({ value: count() }).from(doctorsTable);
      res.json({
        totalChildren: 0,
        unfilledMealRecords: 0,
        last24hUnfilledMealRecords: 0,
        classicDistribution: [
          { ratio: "2:1",   count: 0, label: "2:1"   },
          { ratio: "2.5:1", count: 0, label: "2.5:1" },
          { ratio: "3:1",   count: 0, label: "3:1"   },
          { ratio: "3.5:1", count: 0, label: "3.5:1" },
          { ratio: "4:1",   count: 0, label: "4:1"   },
        ],
        totalDoctors: Number(totalDoctors),
        tokenSummary: { active: 0, used: 0, expired: 0, total: 0 },
        classicChildren: 0,
        madChildren: 0,
        mctChildren: 0,
        lowgiChildren: 0,
      });
      return;
    }

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const allMealDays = await db.select().from(mealDaysTable);
    const recentMealDays = allMealDays.filter((m) => kidIds.includes(m.kidId));

    const last24hLogs = await db
      .select()
      .from(mealLogsTable)
      .where(gte(mealLogsTable.createdAt, cutoff24h));
    const last24hUnfilledMealRecords = last24hLogs
      .filter((l) => kidIds.includes(l.kidId) && !l.isCompleted)
      .length;

    const kidMealStats = new Map<number, { filled: number; total: number }>();
    for (const m of recentMealDays) {
      if (!kidMealStats.has(m.kidId)) kidMealStats.set(m.kidId, { filled: 0, total: 0 });
      const stats = kidMealStats.get(m.kidId)!;
      stats.total++;
      if (m.isFilled) stats.filled++;
    }

    let unfilledMealRecords = 0;

    for (const kid of allKids) {
      const stats = kidMealStats.get(kid.id) || { filled: 0, total: 0 };
      unfilledMealRecords += stats.total - stats.filled;
    }

    const classicChildren = allKids.filter((k) => k.dietType === "classic").length;
    const madChildren = allKids.filter((k) => k.dietType === "mad").length;
    const mctChildren = allKids.filter((k) => k.dietType === "mct").length;
    const lowgiChildren = allKids.filter((k) => k.dietType === "lowgi").length;

    const classicRatios = ["2:1", "2.5:1", "3:1", "3.5:1", "4:1"];
    const classicCountMap = new Map<string, number>();
    for (const ratio of classicRatios) classicCountMap.set(ratio, 0);
    for (const kid of allKids) {
      if (kid.dietType === "classic" && kid.dietSubCategory) {
        const ratio = kid.dietSubCategory;
        if (classicCountMap.has(ratio)) {
          classicCountMap.set(ratio, (classicCountMap.get(ratio) || 0) + 1);
        }
      }
    }
    const classicDistribution = classicRatios.map((ratio) => ({
      ratio,
      count: classicCountMap.get(ratio) || 0,
      label: ratio,
    }));

    const [{ value: totalDoctors }] = await db.select({ value: count() }).from(doctorsTable);

    let tokenSummary = { active: 0, used: 0, expired: 0, total: 0 };
    if (kidIds.length > 0) {
      const tokens = await db.select().from(parentTokensTable).where(inArray(parentTokensTable.kidId, kidIds));
      const now = new Date();
      for (const t of tokens) {
        tokenSummary.total++;
        if (t.status === "revoked" || new Date(t.expiresAt) < now) {
          tokenSummary.expired++;
        } else if (t.status === "used") {
          tokenSummary.used++;
        } else {
          tokenSummary.active++;
        }
      }
    }

    res.json({
      totalChildren,
      unfilledMealRecords,
      last24hUnfilledMealRecords,
      classicDistribution,
      totalDoctors: Number(totalDoctors),
      tokenSummary,
      classicChildren,
      madChildren,
      mctChildren,
      lowgiChildren,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.get("/recent-activity", async (req, res) => {
  const doctorId = req.session.doctorId!;
  const isAdmin = req.session.doctorRole === "admin";

  try {
    const allKids = isAdmin
      ? await db
          .select({ id: kidsTable.id, name: kidsTable.name, dietType: kidsTable.dietType })
          .from(kidsTable)
          .where(eq(kidsTable.doctorId, doctorId))
      : await db
          .select({ id: kidsTable.id, name: kidsTable.name, dietType: kidsTable.dietType })
          .from(kidsTable);

    const kidIds = allKids.map((k) => k.id);
    const kidMap = new Map(allKids.map((k) => [k.id, k]));

    if (kidIds.length === 0) {
      res.json([]);
      return;
    }

    const ownedNotes = await db
      .select()
      .from(notesTable)
      .where(inArray(notesTable.kidId, kidIds))
      .orderBy(desc(notesTable.createdAt))
      .limit(5);

    const ownedWeights = await db
      .select()
      .from(weightRecordsTable)
      .where(inArray(weightRecordsTable.kidId, kidIds))
      .orderBy(desc(weightRecordsTable.createdAt))
      .limit(5);

    type ActivityItem = {
      type: string;
      title: string;
      description: string;
      kidId: number;
      kidName: string;
      timestamp: string;
    };

    const activity: ActivityItem[] = [];

    for (const note of ownedNotes) {
      const kid = kidMap.get(note.kidId!);
      if (!kid) continue;
      activity.push({
        type: "note",
        title: "Note added",
        description: note.content.length > 80 ? note.content.slice(0, 80) + "…" : note.content,
        kidId: kid.id,
        kidName: kid.name,
        timestamp: note.createdAt.toISOString(),
      });
    }

    for (const w of ownedWeights) {
      const kid = kidMap.get(w.kidId);
      if (!kid) continue;
      activity.push({
        type: "weight",
        title: "Weight recorded",
        description: `${w.weight} kg recorded${w.note ? ` — ${w.note}` : ""}`,
        kidId: kid.id,
        kidName: kid.name,
        timestamp: w.createdAt.toISOString(),
      });
    }

    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(activity.slice(0, 5));
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
