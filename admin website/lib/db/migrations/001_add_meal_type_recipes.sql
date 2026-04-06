CREATE TABLE IF NOT EXISTS "meal_type_recipes" (
  "meal_type_id" integer NOT NULL REFERENCES "meal_types"("id") ON DELETE CASCADE,
  "recipe_id" integer NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  PRIMARY KEY ("meal_type_id", "recipe_id")
);
