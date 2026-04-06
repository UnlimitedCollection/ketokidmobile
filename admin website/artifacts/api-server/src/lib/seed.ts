import { db, sideEffectsTable } from "@workspace/db";
import { logger } from "./logger";

const PREDEFINED_SIDE_EFFECTS = [
  "Constipation",
  "Vomiting",
  "Diarrhea",
  "Lethargy/Fatigue",
  "Kidney Stones",
  "High Cholesterol (Hyperlipidemia)",
  "Acidosis",
  "Growth Slowing",
  "Dehydration",
  "Nausea",
  "Abdominal Pain",
  "Reflux (GERD)",
  "Hypoglycemia",
  "Weight Loss (excessive)",
  "Irritability",
  "Poor Appetite",
  "Pancreatitis",
  "Hepatic Steatosis (Fatty Liver)",
  "Carnitine Deficiency",
  "Rash",
];

export async function seedSideEffects(): Promise<void> {
  try {
    const values = PREDEFINED_SIDE_EFFECTS.map((name) => ({ name, isSeeded: true }));
    await db
      .insert(sideEffectsTable)
      .values(values)
      .onConflictDoUpdate({
        target: sideEffectsTable.name,
        set: { isSeeded: true },
      });
    logger.info({ count: values.length }, "Side effects seeded");
  } catch (err) {
    logger.error({ err }, "Failed to seed side effects");
  }
}
