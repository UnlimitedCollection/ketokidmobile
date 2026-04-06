import { db } from "@workspace/db";
import {
  doctorsTable,
  kidsTable,
  medicalSettingsTable,
  weightRecordsTable,
  mealDaysTable,
  mealLogsTable,
  notesTable,
  foodsTable,
  libraryMealPlansTable,
  libraryMealPlanItemsTable,
  mealPlansTable,
  mealPlanItemsTable,
  mealEntriesTable,
  ketoneReadingsTable,
  mealTypesTable,
  mealTypeRecipesTable,
  recipesTable,
  recipeIngredientsTable,
  sideEffectsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

function generatePHNCode(usedCodes?: Set<string>): string {
  let code: string;
  do {
    const d1 = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const d2 = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const d3 = String(Math.floor(Math.random() * 10));
    code = `${d1}-${d2}-${d3}`;
  } while (usedCodes && usedCodes.has(code));
  if (usedCodes) usedCodes.add(code);
  return code;
}

async function migrateLegacyKidCodes() {
  const legacyKids = await db.select({ id: kidsTable.id, kidCode: kidsTable.kidCode }).from(kidsTable);
  const newFormatRegex = /^\d{4}-\d{6}-\d$/;
  const legacyToMigrate = legacyKids.filter((k) => !newFormatRegex.test(k.kidCode));
  if (legacyToMigrate.length === 0) {
    console.log("No legacy codes to migrate — all PHNs are in XXXX-XXXXXX-X format.");
    return;
  }
  const usedCodes = new Set(legacyKids.map((k) => k.kidCode));
  for (const kid of legacyToMigrate) {
    let newCode: string;
    do {
      newCode = generatePHNCode();
    } while (usedCodes.has(newCode));
    usedCodes.add(newCode);
    await db.update(kidsTable).set({ kidCode: newCode }).where(eq(kidsTable.id, kid.id));
    console.log(`Migrated kid ${kid.id}: ${kid.kidCode} → ${newCode}`);
  }
  console.log(`Migrated ${legacyToMigrate.length} legacy codes to XXXX-XXXXXX-X format.`);
}

async function seed() {
  console.log("Seeding database...");

  // ── 0. Migrate legacy KID- codes → PHN format ────────────────────────────────
  await migrateLegacyKidCodes();

  // ── 1. Migrate legacy "doctor" username → "admin" (one-time rename) ─────────
  const legacyDoctors = await db.select().from(doctorsTable).where(eq(doctorsTable.username, "doctor"));
  if (legacyDoctors.length > 0) {
    await db.update(doctorsTable)
      .set({ username: "admin" })
      .where(eq(doctorsTable.username, "doctor"));
    console.log("Migrated legacy 'doctor' account → username='admin'");
  }

  // ── 2. Upsert admin account with bcrypt password ───────────────────────────
  const hashedPassword = await bcrypt.hash("1234", 12);

  const existingAdmins = await db.select().from(doctorsTable).where(eq(doctorsTable.username, "admin"));
  let doctorId: number;

  if (existingAdmins.length > 0) {
    await db.update(doctorsTable)
      .set({ password: hashedPassword, role: "admin" })
      .where(eq(doctorsTable.username, "admin"));
    doctorId = existingAdmins[0].id;
    console.log("Admin account updated (password + role):", doctorId);
  } else {
    const [doctor] = await db
      .insert(doctorsTable)
      .values({
        username: "admin",
        password: hashedPassword,
        name: "Dr. Sarah Johnson",
        email: "sarah.johnson@ketokidcare.com",
        designation: "Pediatric Neurology",
        role: "admin",
      })
      .returning();
    doctorId = doctor.id;
    console.log("Admin account created:", doctorId);
  }

  // ── 2b. Upsert moderator account ─────────────────────────────────────────
  const moderatorPassword = await bcrypt.hash("12345", 12);
  const existingMods = await db.select().from(doctorsTable).where(eq(doctorsTable.username, "admin1"));

  if (existingMods.length > 0) {
    await db.update(doctorsTable)
      .set({ password: moderatorPassword, role: "moderator" })
      .where(eq(doctorsTable.username, "admin1"));
    console.log("Moderator account updated:", existingMods[0].id);
  } else {
    const [mod] = await db
      .insert(doctorsTable)
      .values({
        username: "admin1",
        password: moderatorPassword,
        name: "Dr. Alex Moderator",
        email: "alex.moderator@ketokidcare.com",
        designation: "Pediatric Neurology",
        role: "moderator",
      })
      .returning();
    console.log("Moderator account created:", mod.id);
  }

  // ── 3. Seed keto-appropriate foods with macronutrient categories ──────────
  // Categories: Carb (vegetables/fruits/grain-alternatives), Fat (fat-dense),
  //             Protein (meat/fish/eggs/cheese), Calories (pure calorie-boosting oils)
  const existingFoodCount = await db.select().from(foodsTable);
  if (existingFoodCount.length < 72) {
    const foods = [
      // Carb — low-carb vegetables
      { name: "Avocado",               category: "Fat",      carbs: 2,    fat: 15,   protein: 2,    calories: 160, indicator: "vegi",    description: "High in healthy fats, great for keto",                  servingSize: 100, servingUnit: "g" },
      { name: "Broccoli",              category: "Carb",     carbs: 4,    fat: 0.4,  protein: 2.6,  calories: 34,  indicator: "vegi",    description: "Low-carb cruciferous vegetable",                        servingSize: 1,   servingUnit: "cup" },
      { name: "Spinach",               category: "Carb",     carbs: 1.4,  fat: 0.4,  protein: 2.9,  calories: 23,  indicator: "vegi",    description: "Leafy green rich in iron and magnesium",                servingSize: 1,   servingUnit: "cup" },
      { name: "Cauliflower",           category: "Carb",     carbs: 5,    fat: 0.3,  protein: 1.9,  calories: 25,  indicator: "vegi",    description: "Versatile low-carb vegetable",                          servingSize: 1,   servingUnit: "cup" },
      { name: "Zucchini",              category: "Carb",     carbs: 3.1,  fat: 0.3,  protein: 1.2,  calories: 17,  indicator: "vegi",    description: "Light squash suitable for keto diets",                  servingSize: 100, servingUnit: "g" },
      { name: "Cucumber",              category: "Carb",     carbs: 3.6,  fat: 0.1,  protein: 0.7,  calories: 15,  indicator: "vegi",    description: "Refreshing, very low carb",                             servingSize: 100, servingUnit: "g" },
      { name: "Cabbage",               category: "Carb",     carbs: 5.8,  fat: 0.1,  protein: 1.3,  calories: 25,  indicator: "vegi",    description: "Affordable keto-friendly vegetable",                    servingSize: 1,   servingUnit: "cup" },
      { name: "Bell Pepper",           category: "Carb",     carbs: 4.6,  fat: 0.3,  protein: 0.9,  calories: 20,  indicator: "vegi",    description: "Green peppers lower in carbs",                          servingSize: 100, servingUnit: "g" },
      { name: "Kale",                  category: "Carb",     carbs: 4.4,  fat: 0.9,  protein: 4.3,  calories: 49,  indicator: "vegi",    description: "Nutrient-dense leafy green",                            servingSize: 1,   servingUnit: "cup" },
      { name: "Asparagus",             category: "Carb",     carbs: 3.9,  fat: 0.1,  protein: 2.2,  calories: 20,  indicator: "vegi",    description: "Low-carb spring vegetable",                             servingSize: 100, servingUnit: "g" },
      { name: "Celery",                category: "Carb",     carbs: 3,    fat: 0.2,  protein: 0.7,  calories: 16,  indicator: "vegi",    description: "Very low calorie, keto staple",                         servingSize: 2,   servingUnit: "stalks" },
      { name: "Mushrooms",             category: "Carb",     carbs: 3.3,  fat: 0.3,  protein: 3.1,  calories: 22,  indicator: "vegi",    description: "Savory and low carb",                                   servingSize: 1,   servingUnit: "cup" },
      { name: "Lettuce",               category: "Carb",     carbs: 2.4,  fat: 0.3,  protein: 1.2,  calories: 17,  indicator: "vegi",    description: "Classic salad base",                                    servingSize: 1,   servingUnit: "cup" },
      { name: "Green Beans",           category: "Carb",     carbs: 7,    fat: 0.1,  protein: 1.8,  calories: 31,  indicator: "vegi",    description: "Kid-friendly vegetable",                                servingSize: 1,   servingUnit: "cup" },
      { name: "Eggplant",              category: "Carb",     carbs: 5.9,  fat: 0.2,  protein: 1,    calories: 25,  indicator: "vegi",    description: "Low-carb Mediterranean vegetable",                      servingSize: 100, servingUnit: "g" },
      // Calories — pure calorie-boosting oils used to hit keto fat ratios
      { name: "Olive Oil",             category: "Calories", carbs: 0,    fat: 100,  protein: 0,    calories: 884, indicator: "vegi",    description: "Primary fat source for keto cooking",                   servingSize: 1,   servingUnit: "tbsp" },
      { name: "Coconut Oil",           category: "Calories", carbs: 0,    fat: 100,  protein: 0,    calories: 862, indicator: "vegi",    description: "High MCT fat ideal for ketogenic diets",                servingSize: 1,   servingUnit: "tbsp" },
      { name: "Butter",                category: "Calories", carbs: 0.1,  fat: 81,   protein: 0.9,  calories: 717, indicator: "vegi",    description: "Saturated fat for keto cooking",                        servingSize: 1,   servingUnit: "tbsp" },
      { name: "Avocado Oil",           category: "Calories", carbs: 0,    fat: 100,  protein: 0,    calories: 884, indicator: "vegi",    description: "Neutral-flavored keto cooking oil",                     servingSize: 1,   servingUnit: "tbsp" },
      { name: "MCT Oil",               category: "Calories", carbs: 0,    fat: 100,  protein: 0,    calories: 862, indicator: "vegi",    description: "Medium-chain triglycerides for rapid ketone production", servingSize: 1,   servingUnit: "tbsp" },
      // Fat — fat-dense foods
      { name: "Heavy Cream",           category: "Fat",      carbs: 3.4,  fat: 35,   protein: 2.1,  calories: 340, indicator: "vegi",    description: "High-fat dairy, great for ketogenic ratios",            servingSize: 2,   servingUnit: "tbsp" },
      { name: "Cream Cheese",          category: "Fat",      carbs: 4.1,  fat: 33,   protein: 5.9,  calories: 342, indicator: "vegi",    description: "Rich keto-friendly spread",                             servingSize: 2,   servingUnit: "tbsp" },
      // Protein — cheese & dairy
      { name: "Cheddar Cheese",        category: "Protein",  carbs: 1.3,  fat: 33,   protein: 25,   calories: 403, indicator: "vegi",    description: "Popular hard cheese for keto snacks",                   servingSize: 30,  servingUnit: "g" },
      { name: "Mozzarella",            category: "Protein",  carbs: 2.2,  fat: 22,   protein: 22,   calories: 280, indicator: "vegi",    description: "Mild cheese suitable for children",                     servingSize: 30,  servingUnit: "g" },
      { name: "Parmesan",              category: "Protein",  carbs: 3.2,  fat: 29,   protein: 38,   calories: 431, indicator: "vegi",    description: "Strong flavored, high protein cheese",                  servingSize: 2,   servingUnit: "tbsp" },
      { name: "Greek Yogurt",          category: "Protein",  carbs: 4.1,  fat: 5,    protein: 9,    calories: 97,  indicator: "vegi",    description: "Higher protein dairy option",                           servingSize: 1,   servingUnit: "cup" },
      // Protein — meats
      { name: "Chicken Breast",        category: "Protein",  carbs: 0,    fat: 3.6,  protein: 31,   calories: 165, indicator: "non-vegi", description: "Lean protein source for keto",                         servingSize: 100, servingUnit: "g" },
      { name: "Chicken Thigh",         category: "Protein",  carbs: 0,    fat: 9,    protein: 26,   calories: 209, indicator: "non-vegi", description: "Juicier cut with higher fat content",                  servingSize: 100, servingUnit: "g" },
      { name: "Ground Beef",           category: "Protein",  carbs: 0,    fat: 20,   protein: 26,   calories: 287, indicator: "non-vegi", description: "Versatile keto protein base",                          servingSize: 100, servingUnit: "g" },
      { name: "Beef Ribeye",           category: "Protein",  carbs: 0,    fat: 37,   protein: 27,   calories: 450, indicator: "non-vegi", description: "High-fat cut for higher keto ratios",                  servingSize: 100, servingUnit: "g" },
      { name: "Lamb Chops",            category: "Protein",  carbs: 0,    fat: 24,   protein: 25,   calories: 315, indicator: "non-vegi", description: "Rich lamb meat with good fat content",                 servingSize: 100, servingUnit: "g" },
      { name: "Bacon",                 category: "Protein",  carbs: 0.7,  fat: 42,   protein: 37,   calories: 541, indicator: "non-vegi", description: "High-fat cured meat for keto",                        servingSize: 2,   servingUnit: "slices" },
      { name: "Pork Belly",            category: "Fat",      carbs: 0,    fat: 53,   protein: 9,    calories: 518, indicator: "non-vegi", description: "Very high fat, ideal for 4:1 keto ratio",              servingSize: 100, servingUnit: "g" },
      { name: "Turkey Breast",         category: "Protein",  carbs: 0,    fat: 1,    protein: 29,   calories: 135, indicator: "non-vegi", description: "Very lean poultry protein",                            servingSize: 100, servingUnit: "g" },
      { name: "Duck",                  category: "Protein",  carbs: 0,    fat: 28,   protein: 19,   calories: 337, indicator: "non-vegi", description: "High-fat poultry ideal for keto ratios",               servingSize: 100, servingUnit: "g" },
      // Protein — fish
      { name: "Salmon",                category: "Protein",  carbs: 0,    fat: 13,   protein: 25,   calories: 208, indicator: "non-vegi", description: "Rich omega-3, excellent for keto",                     servingSize: 100, servingUnit: "g" },
      { name: "Tuna",                  category: "Protein",  carbs: 0,    fat: 5,    protein: 25,   calories: 132, indicator: "non-vegi", description: "Convenient protein source",                            servingSize: 100, servingUnit: "g" },
      { name: "Sardines",              category: "Protein",  carbs: 0,    fat: 11,   protein: 25,   calories: 208, indicator: "non-vegi", description: "High omega-3 small fish",                              servingSize: 1,   servingUnit: "can" },
      { name: "Mackerel",              category: "Protein",  carbs: 0,    fat: 13,   protein: 19,   calories: 205, indicator: "non-vegi", description: "Fatty fish high in omega-3s",                          servingSize: 100, servingUnit: "g" },
      { name: "Shrimp",                category: "Protein",  carbs: 0.9,  fat: 1.4,  protein: 24,   calories: 106, indicator: "non-vegi", description: "Low fat seafood, high protein",                       servingSize: 100, servingUnit: "g" },
      { name: "Cod",                   category: "Protein",  carbs: 0,    fat: 0.7,  protein: 18,   calories: 82,  indicator: "non-vegi", description: "Lean white fish, mild flavor",                        servingSize: 100, servingUnit: "g" },
      // Protein — eggs
      { name: "Whole Eggs",            category: "Protein",  carbs: 0.6,  fat: 10,   protein: 13,   calories: 155, indicator: "non-vegi", description: "Complete protein, essential keto food",                servingSize: 2,   servingUnit: "eggs" },
      { name: "Egg Yolks",             category: "Fat",      carbs: 3.6,  fat: 27,   protein: 16,   calories: 322, indicator: "non-vegi", description: "Fat and nutrient dense egg component",                servingSize: 3,   servingUnit: "yolks" },
      // Fat — nuts & seeds
      { name: "Macadamia Nuts",        category: "Fat",      carbs: 5,    fat: 76,   protein: 8,    calories: 718, indicator: "vegi",    description: "Highest fat nut, ideal for keto",                       servingSize: 30,  servingUnit: "g" },
      { name: "Walnuts",               category: "Fat",      carbs: 7,    fat: 65,   protein: 15,   calories: 654, indicator: "vegi",    description: "Rich in omega-3 fatty acids",                           servingSize: 30,  servingUnit: "g" },
      { name: "Almonds",               category: "Fat",      carbs: 10,   fat: 50,   protein: 21,   calories: 579, indicator: "vegi",    description: "Popular keto snack nut",                                servingSize: 30,  servingUnit: "g" },
      { name: "Pecans",                category: "Fat",      carbs: 4,    fat: 72,   protein: 9,    calories: 691, indicator: "vegi",    description: "Very low net carb nut",                                 servingSize: 30,  servingUnit: "g" },
      { name: "Chia Seeds",            category: "Fat",      carbs: 6,    fat: 31,   protein: 17,   calories: 486, indicator: "vegi",    description: "High fiber, omega-3 seeds",                             servingSize: 2,   servingUnit: "tbsp" },
      { name: "Flaxseeds",             category: "Fat",      carbs: 3,    fat: 42,   protein: 18,   calories: 534, indicator: "vegi",    description: "Omega-3 rich seeds for keto baking",                    servingSize: 2,   servingUnit: "tbsp" },
      { name: "Pumpkin Seeds",         category: "Protein",  carbs: 3,    fat: 49,   protein: 30,   calories: 559, indicator: "vegi",    description: "High protein, magnesium-rich",                          servingSize: 30,  servingUnit: "g" },
      { name: "Hemp Seeds",            category: "Protein",  carbs: 3,    fat: 49,   protein: 32,   calories: 553, indicator: "vegi",    description: "Complete protein with great fat ratio",                 servingSize: 3,   servingUnit: "tbsp" },
      { name: "Almond Butter",         category: "Fat",      carbs: 7,    fat: 50,   protein: 21,   calories: 614, indicator: "vegi",    description: "Keto-friendly nut butter",                              servingSize: 2,   servingUnit: "tbsp" },
      // Carb — low-carb fruits
      { name: "Blueberries",           category: "Carb",     carbs: 12,   fat: 0.3,  protein: 0.7,  calories: 57,  indicator: "fruit",   description: "Lower sugar berries for occasional keto use",           servingSize: 0.5, servingUnit: "cup" },
      { name: "Raspberries",           category: "Carb",     carbs: 5.4,  fat: 0.7,  protein: 1.2,  calories: 52,  indicator: "fruit",   description: "Low net carb berries",                                  servingSize: 0.5, servingUnit: "cup" },
      { name: "Strawberries",          category: "Carb",     carbs: 7.7,  fat: 0.3,  protein: 0.7,  calories: 32,  indicator: "fruit",   description: "Moderate carb berries in small portions",               servingSize: 0.5, servingUnit: "cup" },
      { name: "Blackberries",          category: "Carb",     carbs: 5.1,  fat: 0.5,  protein: 1.4,  calories: 43,  indicator: "fruit",   description: "Low net carb berry option",                              servingSize: 0.5, servingUnit: "cup" },
      { name: "Olives",                category: "Fat",      carbs: 3.8,  fat: 11,   protein: 0.8,  calories: 115, indicator: "fruit",   description: "High fat fruit ideal for keto",                         servingSize: 30,  servingUnit: "g" },
      { name: "Coconut Meat",          category: "Fat",      carbs: 6,    fat: 35,   protein: 3.3,  calories: 354, indicator: "fruit",   description: "High-fat tropical fruit for keto",                      servingSize: 50,  servingUnit: "g" },
      // Carb — grain alternatives
      { name: "Almond Flour",          category: "Carb",     carbs: 10,   fat: 54,   protein: 24,   calories: 576, indicator: "vegi",    description: "Low-carb flour alternative for keto baking",            servingSize: 0.25, servingUnit: "cup" },
      { name: "Coconut Flour",         category: "Carb",     carbs: 18,   fat: 9,    protein: 6,    calories: 400, indicator: "vegi",    description: "High-fiber keto baking flour, very absorbent",          servingSize: 2,   servingUnit: "tbsp" },
      { name: "Psyllium Husk",         category: "Carb",     carbs: 2,    fat: 0,    protein: 0,    calories: 20,  indicator: "vegi",    description: "Keto-friendly binder and fiber supplement",             servingSize: 1,   servingUnit: "tbsp" },
      { name: "Flaxseed Meal",         category: "Carb",     carbs: 2,    fat: 9,    protein: 5,    calories: 140, indicator: "vegi",    description: "Ground flaxseeds for keto bread and baking",            servingSize: 2,   servingUnit: "tbsp" },
      // Beverage — keto-friendly drinks
      { name: "Butter Coffee",         category: "Beverage", carbs: 0,    fat: 25,   protein: 1,    calories: 230, indicator: "vegi",    description: "Blended coffee with butter and MCT oil for sustained energy", servingSize: 1, servingUnit: "cup" },
      { name: "Bone Broth",            category: "Beverage", carbs: 0,    fat: 1,    protein: 10,   calories: 50,  indicator: "non-vegi", description: "Mineral-rich broth supporting gut health and electrolytes", servingSize: 1, servingUnit: "cup" },
      { name: "Keto Hot Chocolate",    category: "Beverage", carbs: 3,    fat: 16,   protein: 2,    calories: 170, indicator: "vegi",    description: "Unsweetened cocoa with heavy cream and stevia",         servingSize: 1,   servingUnit: "cup" },
      { name: "MCT Latte",             category: "Beverage", carbs: 0,    fat: 14,   protein: 0.5,  calories: 130, indicator: "vegi",    description: "Espresso blended with MCT oil for quick ketone boost",  servingSize: 1,   servingUnit: "cup" },
      { name: "Golden Milk",           category: "Beverage", carbs: 3,    fat: 12,   protein: 1,    calories: 130, indicator: "vegi",    description: "Turmeric and coconut milk anti-inflammatory drink",     servingSize: 1,   servingUnit: "cup" },
      { name: "Keto Smoothie",         category: "Beverage", carbs: 5,    fat: 20,   protein: 8,    calories: 240, indicator: "vegi",    description: "Avocado, coconut milk, and protein powder blend",       servingSize: 1,   servingUnit: "cup" },
      { name: "Matcha Latte",          category: "Beverage", carbs: 2,    fat: 14,   protein: 1,    calories: 140, indicator: "vegi",    description: "Matcha green tea with coconut cream",                   servingSize: 1,   servingUnit: "cup" },
      { name: "Cream Soda",            category: "Beverage", carbs: 1,    fat: 5,    protein: 0,    calories: 50,  indicator: "vegi",    description: "Sugar-free sparkling water with heavy cream and vanilla", servingSize: 1, servingUnit: "cup" },
      { name: "Keto Chai",             category: "Beverage", carbs: 2,    fat: 10,   protein: 1,    calories: 100, indicator: "vegi",    description: "Spiced chai tea with coconut cream",                    servingSize: 1,   servingUnit: "cup" },
      { name: "Electrolyte Drink",     category: "Beverage", carbs: 1,    fat: 0,    protein: 0,    calories: 5,   indicator: "vegi",    description: "Sugar-free electrolyte mix for hydration on keto",      servingSize: 1,   servingUnit: "cup" },
    ];

    for (const food of foods) {
      await db.insert(foodsTable).values({
        ...food,
        isActive: true,
      }).onConflictDoNothing();
    }
    console.log(`Foods seeded: ${foods.length}`);

  } else {
    console.log(`Foods already seeded (${existingFoodCount.length} found), skipping inserts.`);
  }

  const servingData: Record<string, { servingSize: number; servingUnit: string }> = {
    "Avocado": { servingSize: 100, servingUnit: "g" },
    "Broccoli": { servingSize: 1, servingUnit: "cup" },
    "Spinach": { servingSize: 1, servingUnit: "cup" },
    "Cauliflower": { servingSize: 1, servingUnit: "cup" },
    "Zucchini": { servingSize: 100, servingUnit: "g" },
    "Cucumber": { servingSize: 100, servingUnit: "g" },
    "Cabbage": { servingSize: 1, servingUnit: "cup" },
    "Bell Pepper": { servingSize: 100, servingUnit: "g" },
    "Kale": { servingSize: 1, servingUnit: "cup" },
    "Asparagus": { servingSize: 100, servingUnit: "g" },
    "Celery": { servingSize: 2, servingUnit: "stalks" },
    "Mushrooms": { servingSize: 1, servingUnit: "cup" },
    "Lettuce": { servingSize: 1, servingUnit: "cup" },
    "Green Beans": { servingSize: 1, servingUnit: "cup" },
    "Eggplant": { servingSize: 100, servingUnit: "g" },
    "Olive Oil": { servingSize: 1, servingUnit: "tbsp" },
    "Coconut Oil": { servingSize: 1, servingUnit: "tbsp" },
    "Butter": { servingSize: 1, servingUnit: "tbsp" },
    "Avocado Oil": { servingSize: 1, servingUnit: "tbsp" },
    "MCT Oil": { servingSize: 1, servingUnit: "tbsp" },
    "Heavy Cream": { servingSize: 2, servingUnit: "tbsp" },
    "Cream Cheese": { servingSize: 2, servingUnit: "tbsp" },
    "Cheddar Cheese": { servingSize: 30, servingUnit: "g" },
    "Mozzarella": { servingSize: 30, servingUnit: "g" },
    "Parmesan": { servingSize: 2, servingUnit: "tbsp" },
    "Greek Yogurt": { servingSize: 1, servingUnit: "cup" },
    "Chicken Breast": { servingSize: 100, servingUnit: "g" },
    "Chicken Thigh": { servingSize: 100, servingUnit: "g" },
    "Ground Beef": { servingSize: 100, servingUnit: "g" },
    "Beef Ribeye": { servingSize: 100, servingUnit: "g" },
    "Lamb Chops": { servingSize: 100, servingUnit: "g" },
    "Bacon": { servingSize: 2, servingUnit: "slices" },
    "Pork Belly": { servingSize: 100, servingUnit: "g" },
    "Turkey Breast": { servingSize: 100, servingUnit: "g" },
    "Duck": { servingSize: 100, servingUnit: "g" },
    "Salmon": { servingSize: 100, servingUnit: "g" },
    "Tuna": { servingSize: 100, servingUnit: "g" },
    "Sardines": { servingSize: 1, servingUnit: "can" },
    "Mackerel": { servingSize: 100, servingUnit: "g" },
    "Shrimp": { servingSize: 100, servingUnit: "g" },
    "Cod": { servingSize: 100, servingUnit: "g" },
    "Whole Eggs": { servingSize: 2, servingUnit: "eggs" },
    "Egg Yolks": { servingSize: 3, servingUnit: "yolks" },
    "Macadamia Nuts": { servingSize: 30, servingUnit: "g" },
    "Walnuts": { servingSize: 30, servingUnit: "g" },
    "Almonds": { servingSize: 30, servingUnit: "g" },
    "Pecans": { servingSize: 30, servingUnit: "g" },
    "Chia Seeds": { servingSize: 2, servingUnit: "tbsp" },
    "Flaxseeds": { servingSize: 2, servingUnit: "tbsp" },
    "Pumpkin Seeds": { servingSize: 30, servingUnit: "g" },
    "Hemp Seeds": { servingSize: 3, servingUnit: "tbsp" },
    "Almond Butter": { servingSize: 2, servingUnit: "tbsp" },
    "Blueberries": { servingSize: 0.5, servingUnit: "cup" },
    "Raspberries": { servingSize: 0.5, servingUnit: "cup" },
    "Strawberries": { servingSize: 0.5, servingUnit: "cup" },
    "Blackberries": { servingSize: 0.5, servingUnit: "cup" },
    "Olives": { servingSize: 30, servingUnit: "g" },
    "Coconut Meat": { servingSize: 50, servingUnit: "g" },
    "Almond Flour": { servingSize: 0.25, servingUnit: "cup" },
    "Coconut Flour": { servingSize: 2, servingUnit: "tbsp" },
    "Psyllium Husk": { servingSize: 1, servingUnit: "tbsp" },
    "Flaxseed Meal": { servingSize: 2, servingUnit: "tbsp" },
    "Butter Coffee": { servingSize: 1, servingUnit: "cup" },
    "Bone Broth": { servingSize: 1, servingUnit: "cup" },
    "Keto Hot Chocolate": { servingSize: 1, servingUnit: "cup" },
    "MCT Latte": { servingSize: 1, servingUnit: "cup" },
    "Golden Milk": { servingSize: 1, servingUnit: "cup" },
    "Keto Smoothie": { servingSize: 1, servingUnit: "cup" },
    "Matcha Latte": { servingSize: 1, servingUnit: "cup" },
    "Cream Soda": { servingSize: 1, servingUnit: "cup" },
    "Keto Chai": { servingSize: 1, servingUnit: "cup" },
    "Electrolyte Drink": { servingSize: 1, servingUnit: "cup" },
  };

  for (const [name, serving] of Object.entries(servingData)) {
    await db.update(foodsTable)
      .set({ servingSize: serving.servingSize, servingUnit: serving.servingUnit })
      .where(eq(foodsTable.name, name));
  }
  console.log(`Foods serving sizes updated for ${Object.keys(servingData).length} items`);

  // ── 3b. Seed default meal types ────────────────────────────────────────────
  // Remove legacy snack meal types if they exist
  const snackMealTypeNames = ["Morning Snack", "Snack"];
  const snackMealTypes = await db.select().from(mealTypesTable).where(inArray(mealTypesTable.name, snackMealTypeNames));
  if (snackMealTypes.length > 0) {
    const snackIds = snackMealTypes.map((mt) => mt.id);
    await db.delete(mealTypeRecipesTable).where(inArray(mealTypeRecipesTable.mealTypeId, snackIds));
    await db.delete(mealTypesTable).where(inArray(mealTypesTable.id, snackIds));
    console.log(`Removed legacy snack meal types: ${snackMealTypes.map((mt) => mt.name).join(", ")}`);
  }

  const defaultMealTypes = ["Breakfast", "Lunch", "Dinner"];
  for (const name of defaultMealTypes) {
    await db.insert(mealTypesTable).values({ name }).onConflictDoNothing();
  }
  const allMealTypes = await db.select().from(mealTypesTable);
  console.log(`Meal types seeded/verified: ${allMealTypes.length} total`);

  // ── 4. Seed library meal plans ────────────────────────────────────────────
  const existingPlans = await db.select().from(libraryMealPlansTable).where(eq(libraryMealPlansTable.doctorId, doctorId));
  const existingPlanNames = new Set(existingPlans.map((p) => p.name));
  if (existingPlanNames.size < 20) {
    const existingPlanIds = existingPlans.map((p) => p.id);
    if (existingPlanIds.length > 0) {
      await db.delete(libraryMealPlanItemsTable).where(inArray(libraryMealPlanItemsTable.planId, existingPlanIds));
      await db.delete(libraryMealPlansTable).where(eq(libraryMealPlansTable.doctorId, doctorId));
      existingPlanNames.clear();
      console.log(`Removed ${existingPlanIds.length} existing library meal plans for deterministic reseed...`);
    }
    const plans = [
      {
        name: "Gentle Starter Plan",
        description: "Gentle introduction to the ketogenic diet with 2:1 ratio. Ideal for newly diagnosed patients.",
        items: [
          { mealType: "Breakfast", foodName: "Scrambled Eggs with Butter",     portionGrams: 120, unit: "g", calories: 210, carbs: 1.2, fat: 18,   protein: 12 },
          { mealType: "Breakfast", foodName: "Heavy Cream",                     portionGrams: 30,  unit: "g", calories: 102, carbs: 1,   fat: 10.5, protein: 0.6 },
          { mealType: "Lunch",     foodName: "Chicken Breast with Avocado",     portionGrams: 150, unit: "g", calories: 290, carbs: 3,   fat: 20,   protein: 24 },
          { mealType: "Lunch",     foodName: "Broccoli with Butter",            portionGrams: 80,  unit: "g", calories: 85,  carbs: 4,   fat: 6,    protein: 2 },
          { mealType: "Dinner",    foodName: "Salmon with Cream Cheese",        portionGrams: 140, unit: "g", calories: 320, carbs: 2,   fat: 25,   protein: 22 },
          { mealType: "Dinner",    foodName: "Spinach Salad with Olive Oil",    portionGrams: 60,  unit: "g", calories: 70,  carbs: 1,   fat: 6,    protein: 1.5 },
          { mealType: "Breakfast", foodName: "Macadamia Nuts",                  portionGrams: 25,  unit: "g", calories: 180, carbs: 1.3, fat: 19,   protein: 2 },
        ],
      },
      {
        name: "Classic Keto 3:1",
        description: "Standard 3:1 ketogenic ratio. Balanced macros for children in stable keto therapy.",
        items: [
          { mealType: "Breakfast", foodName: "Eggs with Bacon and Butter",      portionGrams: 150, unit: "g", calories: 380, carbs: 1,   fat: 32,   protein: 22 },
          { mealType: "Breakfast", foodName: "Avocado",                         portionGrams: 60,  unit: "g", calories: 96,  carbs: 1.2, fat: 9,    protein: 1.2 },
          { mealType: "Lunch",     foodName: "Ground Beef with Cauliflower",    portionGrams: 180, unit: "g", calories: 350, carbs: 5,   fat: 28,   protein: 22 },
          { mealType: "Lunch",     foodName: "Cheddar Cheese",                  portionGrams: 30,  unit: "g", calories: 121, carbs: 0.4, fat: 10,   protein: 7.5 },
          { mealType: "Dinner",    foodName: "Chicken Thigh with Cream Sauce",  portionGrams: 200, unit: "g", calories: 420, carbs: 3,   fat: 34,   protein: 28 },
          { mealType: "Dinner",    foodName: "Zucchini with Olive Oil",         portionGrams: 100, unit: "g", calories: 50,  carbs: 3,   fat: 3.5,  protein: 1.2 },
          { mealType: "Breakfast", foodName: "Walnuts and Cream Cheese",        portionGrams: 40,  unit: "g", calories: 195, carbs: 2.8, fat: 18,   protein: 5 },
        ],
      },
      {
        name: "High Ratio 4:1",
        description: "Strict 4:1 ketogenic ratio for seizure control. Higher fat content for maximum ketosis.",
        items: [
          { mealType: "Breakfast", foodName: "Egg Yolks with MCT Oil",          portionGrams: 80,  unit: "g", calories: 310, carbs: 2.9, fat: 30,   protein: 9 },
          { mealType: "Breakfast", foodName: "Heavy Cream Smoothie",            portionGrams: 120, unit: "g", calories: 408, carbs: 4,   fat: 42,   protein: 2.5 },
          { mealType: "Lunch",     foodName: "Pork Belly with Spinach",         portionGrams: 120, unit: "g", calories: 480, carbs: 1,   fat: 45,   protein: 16 },
          { mealType: "Lunch",     foodName: "Avocado with Olive Oil",          portionGrams: 80,  unit: "g", calories: 210, carbs: 2,   fat: 20,   protein: 1.6 },
          { mealType: "Dinner",    foodName: "Salmon with Butter Sauce",        portionGrams: 150, unit: "g", calories: 420, carbs: 0.5, fat: 35,   protein: 28 },
          { mealType: "Dinner",    foodName: "Macadamia Nut Cream",             portionGrams: 50,  unit: "g", calories: 359, carbs: 2.5, fat: 38,   protein: 4 },
          { mealType: "Breakfast", foodName: "Coconut Oil Fat Bomb",            portionGrams: 30,  unit: "g", calories: 259, carbs: 0,   fat: 28,   protein: 0.5 },
        ],
      },
      {
        name: "Maintenance Plan",
        description: "Modified ketogenic diet for long-term maintenance. Allows slightly higher carbs.",
        items: [
          { mealType: "Breakfast", foodName: "Greek Yogurt with Berries",       portionGrams: 150, unit: "g", calories: 165, carbs: 12,  fat: 8,    protein: 14 },
          { mealType: "Breakfast", foodName: "Almond Butter with Eggs",         portionGrams: 100, unit: "g", calories: 280, carbs: 5,   fat: 22,   protein: 16 },
          { mealType: "Lunch",     foodName: "Tuna Salad with Avocado",         portionGrams: 200, unit: "g", calories: 340, carbs: 5,   fat: 24,   protein: 26 },
          { mealType: "Lunch",     foodName: "Mixed Greens with Olive Oil",     portionGrams: 80,  unit: "g", calories: 75,  carbs: 4,   fat: 6,    protein: 1.5 },
          { mealType: "Dinner",    foodName: "Beef Ribeye with Vegetables",     portionGrams: 180, unit: "g", calories: 520, carbs: 8,   fat: 38,   protein: 35 },
          { mealType: "Dinner",    foodName: "Broccoli with Cheddar",           portionGrams: 100, unit: "g", calories: 145, carbs: 5,   fat: 11,   protein: 7 },
          { mealType: "Breakfast", foodName: "Pecans and Raspberries",          portionGrams: 40,  unit: "g", calories: 200, carbs: 5,   fat: 18,   protein: 3 },
        ],
      },
      {
        name: "Anti-Seizure Intensive",
        description: "Modified Atkins approach with strict carb limits. Designed for drug-resistant epilepsy.",
        items: [
          { mealType: "Breakfast", foodName: "Bacon and Eggs with Coconut Oil", portionGrams: 130, unit: "g", calories: 420, carbs: 0.7, fat: 38,   protein: 22 },
          { mealType: "Breakfast", foodName: "Flaxseed Keto Porridge",          portionGrams: 80,  unit: "g", calories: 200, carbs: 3,   fat: 16,   protein: 8 },
          { mealType: "Lunch",     foodName: "Duck with Cauliflower Mash",      portionGrams: 200, unit: "g", calories: 480, carbs: 6,   fat: 38,   protein: 28 },
          { mealType: "Lunch",     foodName: "Cream Cheese with Celery",        portionGrams: 80,  unit: "g", calories: 175, carbs: 2.4, fat: 16,   protein: 4 },
          { mealType: "Dinner",    foodName: "Lamb Chops with Herb Butter",     portionGrams: 180, unit: "g", calories: 530, carbs: 0,   fat: 42,   protein: 38 },
          { mealType: "Dinner",    foodName: "Asparagus with Parmesan",         portionGrams: 100, unit: "g", calories: 90,  carbs: 4,   fat: 5,    protein: 6 },
          { mealType: "Breakfast", foodName: "Hemp Seeds with Heavy Cream",     portionGrams: 45,  unit: "g", calories: 270, carbs: 1.5, fat: 24,   protein: 10 },
        ],
      },
      {
        name: "Vegetarian Keto Plan",
        description: "Plant-based ketogenic meal plan with no meat. Relies on eggs, cheese, nuts, and low-carb vegetables.",
        items: [
          { mealType: "Breakfast", foodName: "Scrambled Eggs with Cream Cheese",  portionGrams: 130, unit: "g", calories: 295, carbs: 2.1, fat: 24,   protein: 17 },
          { mealType: "Breakfast", foodName: "Avocado",                            portionGrams: 70,  unit: "g", calories: 112, carbs: 1.4, fat: 10.5, protein: 1.4 },
          { mealType: "Lunch",     foodName: "Macadamia Nuts",                    portionGrams: 30,  unit: "g", calories: 215, carbs: 1.5, fat: 22.8, protein: 2.4 },
          { mealType: "Lunch",     foodName: "Eggplant with Mozzarella",          portionGrams: 200, unit: "g", calories: 250, carbs: 9,   fat: 16,   protein: 12 },
          { mealType: "Lunch",     foodName: "Olive Oil Dressed Greens",          portionGrams: 80,  unit: "g", calories: 95,  carbs: 2.4, fat: 8.5,  protein: 1.2 },
          { mealType: "Dinner",    foodName: "Cauliflower with Cheddar Sauce",    portionGrams: 220, unit: "g", calories: 310, carbs: 9,   fat: 24,   protein: 14 },
          { mealType: "Dinner",    foodName: "Parmesan Roasted Asparagus",        portionGrams: 100, unit: "g", calories: 110, carbs: 4.5, fat: 7,    protein: 7 },
        ],
      },
      {
        name: "Dairy-Free Keto Plan",
        description: "Ketogenic meal plan free from dairy. Uses coconut and avocado-based fats for ratio compliance.",
        items: [
          { mealType: "Breakfast", foodName: "Eggs Fried in Coconut Oil",         portionGrams: 120, unit: "g", calories: 290, carbs: 0.7, fat: 25,   protein: 15 },
          { mealType: "Breakfast", foodName: "Avocado",                            portionGrams: 80,  unit: "g", calories: 128, carbs: 1.6, fat: 12,   protein: 1.6 },
          { mealType: "Lunch",     foodName: "Walnuts",                           portionGrams: 25,  unit: "g", calories: 164, carbs: 1.8, fat: 16.3, protein: 3.8 },
          { mealType: "Lunch",     foodName: "Chicken Breast with Avocado Oil",   portionGrams: 160, unit: "g", calories: 320, carbs: 0,   fat: 22,   protein: 30 },
          { mealType: "Lunch",     foodName: "Kale Salad with Avocado",           portionGrams: 100, unit: "g", calories: 140, carbs: 4.4, fat: 10,   protein: 4.3 },
          { mealType: "Dinner",    foodName: "Salmon with Avocado Oil Drizzle",   portionGrams: 160, unit: "g", calories: 390, carbs: 0,   fat: 31,   protein: 29 },
          { mealType: "Dinner",    foodName: "Steamed Broccoli",                  portionGrams: 100, unit: "g", calories: 34,  carbs: 4,   fat: 0.4,  protein: 2.6 },
        ],
      },
      {
        name: "Toddler Keto Plan (Ages 1–3)",
        description: "Gentle ketogenic meal plan for very young children. Smaller portions, higher fat using cream and butter.",
        items: [
          { mealType: "Breakfast", foodName: "Soft Scrambled Eggs with Butter",   portionGrams: 80,  unit: "g", calories: 185, carbs: 0.6, fat: 16,   protein: 10 },
          { mealType: "Breakfast", foodName: "Heavy Cream",                        portionGrams: 20,  unit: "g", calories: 68,  carbs: 0.7, fat: 7,    protein: 0.4 },
          { mealType: "Breakfast", foodName: "Cream Cheese",                      portionGrams: 20,  unit: "g", calories: 68,  carbs: 0.8, fat: 6.6,  protein: 1.2 },
          { mealType: "Lunch",     foodName: "Pureed Cauliflower with Butter",    portionGrams: 100, unit: "g", calories: 110, carbs: 5,   fat: 8.1,  protein: 1.9 },
          { mealType: "Lunch",     foodName: "Flaked Salmon with Olive Oil",      portionGrams: 80,  unit: "g", calories: 200, carbs: 0,   fat: 15,   protein: 16 },
          { mealType: "Dinner",    foodName: "Ground Beef with Butter",           portionGrams: 80,  unit: "g", calories: 265, carbs: 0,   fat: 22,   protein: 15 },
          { mealType: "Dinner",    foodName: "Mashed Avocado",                    portionGrams: 50,  unit: "g", calories: 80,  carbs: 1,   fat: 7.5,  protein: 1 },
        ],
      },
      {
        name: "Teen Active Keto Plan",
        description: "Higher calorie ketogenic plan for active teenagers. Supports growth while maintaining therapeutic ketosis.",
        items: [
          { mealType: "Breakfast", foodName: "Bacon, Eggs, and Avocado",          portionGrams: 200, unit: "g", calories: 490, carbs: 2,   fat: 42,   protein: 30 },
          { mealType: "Breakfast", foodName: "Greek Yogurt with Nuts",            portionGrams: 100, unit: "g", calories: 200, carbs: 5,   fat: 14,   protein: 12 },
          { mealType: "Lunch",     foodName: "Almond Butter and Celery",          portionGrams: 60,  unit: "g", calories: 200, carbs: 3.6, fat: 16,   protein: 6.5 },
          { mealType: "Lunch",     foodName: "Beef Ribeye Strips Salad",          portionGrams: 200, unit: "g", calories: 520, carbs: 4,   fat: 40,   protein: 35 },
          { mealType: "Lunch",     foodName: "Cheddar Cheese Block",              portionGrams: 40,  unit: "g", calories: 161, carbs: 0.5, fat: 13.2, protein: 10 },
          { mealType: "Dinner",    foodName: "Chicken Thigh with Cream Sauce",    portionGrams: 220, unit: "g", calories: 462, carbs: 3.3, fat: 37.4, protein: 30.8 },
          { mealType: "Dinner",    foodName: "Roasted Zucchini with Parmesan",   portionGrams: 120, unit: "g", calories: 130, carbs: 4.5, fat: 8,    protein: 6 },
        ],
      },
      {
        name: "Snack-Rich Modified Atkins",
        description: "Modified Atkins approach with structured snacks for children who need frequent small meals throughout the day.",
        items: [
          { mealType: "Breakfast", foodName: "Keto Egg Muffins",                 portionGrams: 120, unit: "g", calories: 280, carbs: 2,   fat: 22,   protein: 18 },
          { mealType: "Breakfast", foodName: "Macadamia Nuts",                   portionGrams: 20,  unit: "g", calories: 144, carbs: 1,   fat: 15.2, protein: 1.6 },
          { mealType: "Breakfast", foodName: "Cream Cheese",                     portionGrams: 20,  unit: "g", calories: 68,  carbs: 0.8, fat: 6.6,  protein: 1.2 },
          { mealType: "Lunch",     foodName: "Chicken Thigh with Spinach",       portionGrams: 180, unit: "g", calories: 350, carbs: 1.5, fat: 26,   protein: 27 },
          { mealType: "Lunch",     foodName: "Pumpkin Seeds with Olive Oil",     portionGrams: 25,  unit: "g", calories: 145, carbs: 0.8, fat: 12.3, protein: 7.5 },
          { mealType: "Dinner",    foodName: "Salmon with Butter and Broccoli",  portionGrams: 200, unit: "g", calories: 450, carbs: 4.4, fat: 34,   protein: 30 },
        ],
      },
      {
        name: "Egg-Free Keto Plan",
        description: "Designed for children with egg allergies. Relies on meats, fish, nuts, and healthy fats.",
        items: [
          { mealType: "Breakfast", foodName: "Bacon with Avocado",               portionGrams: 120, unit: "g", calories: 340, carbs: 1.5, fat: 30,   protein: 16 },
          { mealType: "Breakfast", foodName: "Coconut Cream Smoothie",           portionGrams: 150, unit: "g", calories: 280, carbs: 3,   fat: 28,   protein: 2.5 },
          { mealType: "Lunch",     foodName: "Turkey Meatballs with Butter",     portionGrams: 160, unit: "g", calories: 380, carbs: 2,   fat: 28,   protein: 30 },
          { mealType: "Lunch",     foodName: "Cucumber with Cream Cheese",       portionGrams: 80,  unit: "g", calories: 95,  carbs: 2.5, fat: 8,    protein: 2 },
          { mealType: "Dinner",    foodName: "Grilled Salmon with Herb Butter",  portionGrams: 150, unit: "g", calories: 380, carbs: 0,   fat: 28,   protein: 32 },
          { mealType: "Dinner",    foodName: "Steamed Green Beans with Olive Oil", portionGrams: 100, unit: "g", calories: 65,  carbs: 4,  fat: 4,    protein: 2 },
        ],
      },
      {
        name: "Nut-Free Keto Plan",
        description: "Safe for children with tree nut and peanut allergies. Uses seeds, dairy, and animal fats.",
        items: [
          { mealType: "Breakfast", foodName: "Scrambled Eggs with Cheese",       portionGrams: 130, unit: "g", calories: 310, carbs: 1.5, fat: 24,   protein: 22 },
          { mealType: "Breakfast", foodName: "Butter and Heavy Cream",           portionGrams: 40,  unit: "g", calories: 180, carbs: 0.5, fat: 20,   protein: 0.5 },
          { mealType: "Lunch",     foodName: "Chicken Drumstick with Butter",    portionGrams: 150, unit: "g", calories: 310, carbs: 0,   fat: 22,   protein: 28 },
          { mealType: "Lunch",     foodName: "Avocado and Sunflower Seeds",      portionGrams: 90,  unit: "g", calories: 200, carbs: 3,   fat: 18,   protein: 4 },
          { mealType: "Dinner",    foodName: "Beef Patty with Cheddar",          portionGrams: 180, unit: "g", calories: 440, carbs: 1,   fat: 34,   protein: 32 },
          { mealType: "Dinner",    foodName: "Buttered Broccoli",                portionGrams: 100, unit: "g", calories: 85,  carbs: 4,   fat: 6,    protein: 2.5 },
        ],
      },
      {
        name: "MCT Oil Focus Plan",
        description: "Emphasizes MCT oil supplementation for faster ketone production with lower overall fat requirement.",
        items: [
          { mealType: "Breakfast", foodName: "Eggs with MCT Oil",                portionGrams: 100, unit: "g", calories: 270, carbs: 1,   fat: 22,   protein: 13 },
          { mealType: "Breakfast", foodName: "Cream Cheese on Cucumber",         portionGrams: 80,  unit: "g", calories: 120, carbs: 2,   fat: 10,   protein: 3 },
          { mealType: "Lunch",     foodName: "Tuna with MCT Oil Dressing",       portionGrams: 150, unit: "g", calories: 300, carbs: 1,   fat: 22,   protein: 26 },
          { mealType: "Lunch",     foodName: "Spinach with Olive Oil",           portionGrams: 80,  unit: "g", calories: 65,  carbs: 1.5, fat: 5.5,  protein: 2 },
          { mealType: "Dinner",    foodName: "Chicken with MCT Cream Sauce",     portionGrams: 180, unit: "g", calories: 390, carbs: 2,   fat: 30,   protein: 28 },
          { mealType: "Dinner",    foodName: "Cauliflower Mash with Butter",     portionGrams: 120, unit: "g", calories: 110, carbs: 5,   fat: 8,    protein: 2 },
        ],
      },
      {
        name: "Low Calorie Keto Plan",
        description: "Calorie-restricted ketogenic plan for overweight children. Maintains ketosis with controlled portions.",
        items: [
          { mealType: "Breakfast", foodName: "Boiled Egg with Avocado",          portionGrams: 100, unit: "g", calories: 180, carbs: 1.5, fat: 14,   protein: 10 },
          { mealType: "Breakfast", foodName: "Cucumber Slices",                  portionGrams: 50,  unit: "g", calories: 8,   carbs: 1.8, fat: 0.1,  protein: 0.3 },
          { mealType: "Lunch",     foodName: "Grilled Chicken Breast",           portionGrams: 120, unit: "g", calories: 190, carbs: 0,   fat: 8,    protein: 28 },
          { mealType: "Lunch",     foodName: "Mixed Salad with Olive Oil",       portionGrams: 100, unit: "g", calories: 80,  carbs: 3,   fat: 6,    protein: 1.5 },
          { mealType: "Dinner",    foodName: "White Fish with Lemon Butter",     portionGrams: 140, unit: "g", calories: 200, carbs: 0.5, fat: 12,   protein: 24 },
          { mealType: "Dinner",    foodName: "Steamed Asparagus",                portionGrams: 80,  unit: "g", calories: 20,  carbs: 2,   fat: 0.2,  protein: 2.2 },
        ],
      },
      {
        name: "High Protein Keto Plan",
        description: "Higher protein ketogenic plan for children needing muscle support. Protein slightly elevated while maintaining ketosis.",
        items: [
          { mealType: "Breakfast", foodName: "Egg White Omelet with Cheese",     portionGrams: 150, unit: "g", calories: 240, carbs: 1.5, fat: 16,   protein: 24 },
          { mealType: "Breakfast", foodName: "Turkey Sausage",                   portionGrams: 60,  unit: "g", calories: 120, carbs: 0.5, fat: 8,    protein: 12 },
          { mealType: "Lunch",     foodName: "Grilled Chicken with Avocado",     portionGrams: 200, unit: "g", calories: 380, carbs: 3,   fat: 24,   protein: 38 },
          { mealType: "Lunch",     foodName: "Cottage Cheese",                   portionGrams: 80,  unit: "g", calories: 80,  carbs: 3,   fat: 4,    protein: 10 },
          { mealType: "Dinner",    foodName: "Beef Steak with Butter",           portionGrams: 180, unit: "g", calories: 460, carbs: 0,   fat: 32,   protein: 42 },
          { mealType: "Dinner",    foodName: "Steamed Broccoli",                 portionGrams: 100, unit: "g", calories: 34,  carbs: 4,   fat: 0.4,  protein: 2.6 },
        ],
      },
      {
        name: "Mediterranean Keto Plan",
        description: "Mediterranean-inspired ketogenic diet rich in olive oil, fish, and fresh vegetables.",
        items: [
          { mealType: "Breakfast", foodName: "Feta Cheese Omelet",               portionGrams: 140, unit: "g", calories: 280, carbs: 2,   fat: 22,   protein: 18 },
          { mealType: "Breakfast", foodName: "Olives",                           portionGrams: 30,  unit: "g", calories: 35,  carbs: 1.1, fat: 3.3,  protein: 0.2 },
          { mealType: "Lunch",     foodName: "Grilled Sardines with Olive Oil",  portionGrams: 150, unit: "g", calories: 320, carbs: 0,   fat: 22,   protein: 28 },
          { mealType: "Lunch",     foodName: "Tomato and Cucumber Salad",        portionGrams: 100, unit: "g", calories: 45,  carbs: 5,   fat: 2,    protein: 1.5 },
          { mealType: "Dinner",    foodName: "Lamb with Herb Olive Oil",         portionGrams: 160, unit: "g", calories: 420, carbs: 0,   fat: 32,   protein: 34 },
          { mealType: "Dinner",    foodName: "Roasted Zucchini with Feta",       portionGrams: 120, unit: "g", calories: 95,  carbs: 4,   fat: 6.5,  protein: 4 },
        ],
      },
      {
        name: "Ketogenic Smoothie Plan",
        description: "Smoothie-based ketogenic plan for children who have difficulty eating solid foods.",
        items: [
          { mealType: "Breakfast", foodName: "Avocado Cocoa Smoothie",           portionGrams: 200, unit: "g", calories: 320, carbs: 6,   fat: 28,   protein: 6 },
          { mealType: "Breakfast", foodName: "Cream Cheese Bites",               portionGrams: 40,  unit: "g", calories: 136, carbs: 1.6, fat: 13.2, protein: 2.4 },
          { mealType: "Lunch",     foodName: "Coconut Cream Berry Smoothie",     portionGrams: 200, unit: "g", calories: 290, carbs: 8,   fat: 26,   protein: 3 },
          { mealType: "Lunch",     foodName: "Hard Boiled Egg",                  portionGrams: 50,  unit: "g", calories: 78,  carbs: 0.6, fat: 5.3,  protein: 6.3 },
          { mealType: "Dinner",    foodName: "Chicken Bone Broth with Butter",   portionGrams: 250, unit: "g", calories: 180, carbs: 1,   fat: 14,   protein: 12 },
          { mealType: "Dinner",    foodName: "MCT Oil Vanilla Shake",            portionGrams: 150, unit: "g", calories: 260, carbs: 2,   fat: 28,   protein: 1 },
        ],
      },
      {
        name: "School Day Keto Plan",
        description: "Designed for school-aged children with easy-to-pack lunch options and quick breakfast meals.",
        items: [
          { mealType: "Breakfast", foodName: "Cheese Roll-Ups with Bacon",       portionGrams: 100, unit: "g", calories: 320, carbs: 1,   fat: 26,   protein: 20 },
          { mealType: "Breakfast", foodName: "Cream Cheese",                     portionGrams: 25,  unit: "g", calories: 85,  carbs: 1,   fat: 8.3,  protein: 1.5 },
          { mealType: "Lunch",     foodName: "Turkey and Cheese Lettuce Wraps",  portionGrams: 150, unit: "g", calories: 280, carbs: 2,   fat: 20,   protein: 24 },
          { mealType: "Lunch",     foodName: "Celery with Almond Butter",        portionGrams: 60,  unit: "g", calories: 130, carbs: 3,   fat: 10,   protein: 4 },
          { mealType: "Dinner",    foodName: "Baked Chicken Thigh",              portionGrams: 160, unit: "g", calories: 340, carbs: 0,   fat: 24,   protein: 30 },
          { mealType: "Dinner",    foodName: "Cauliflower with Cheese Sauce",    portionGrams: 120, unit: "g", calories: 140, carbs: 5,   fat: 10,   protein: 6 },
        ],
      },
      {
        name: "Weekend Treat Keto Plan",
        description: "Slightly more varied weekend plan with keto-friendly treats. Great for maintaining compliance on weekends.",
        items: [
          { mealType: "Breakfast", foodName: "Keto Pancakes with Butter",        portionGrams: 120, unit: "g", calories: 310, carbs: 4,   fat: 26,   protein: 16 },
          { mealType: "Breakfast", foodName: "Sugar-Free Whipped Cream",         portionGrams: 30,  unit: "g", calories: 50,  carbs: 0.5, fat: 5,    protein: 0.3 },
          { mealType: "Lunch",     foodName: "Cheeseburger Lettuce Wrap",        portionGrams: 200, unit: "g", calories: 450, carbs: 3,   fat: 34,   protein: 32 },
          { mealType: "Lunch",     foodName: "Avocado Fries (baked)",            portionGrams: 80,  unit: "g", calories: 160, carbs: 3,   fat: 14,   protein: 2 },
          { mealType: "Dinner",    foodName: "Pizza Chicken (cheese-topped)",    portionGrams: 180, unit: "g", calories: 380, carbs: 3,   fat: 24,   protein: 36 },
          { mealType: "Dinner",    foodName: "Keto Chocolate Fat Bomb",          portionGrams: 30,  unit: "g", calories: 200, carbs: 2,   fat: 20,   protein: 2 },
        ],
      },
    ];

    let newPlanCount = 0;
    for (const plan of plans) {
      if (existingPlanNames.has(plan.name)) continue;
      const [created] = await db.insert(libraryMealPlansTable).values({
        doctorId,
        name: plan.name,
        description: plan.description,
      }).returning();

      for (const item of plan.items) {
        await db.insert(libraryMealPlanItemsTable).values({
          planId: created.id,
          ...item,
          notes: "",
        });
      }
      newPlanCount++;
    }
    console.log(`Library meal plans seeded: ${newPlanCount} new (${newPlanCount} total)`);
  } else {
    console.log(`Library meal plans already seeded (${existingPlans.length} found, >= 20), skipping.`);
  }

  // ── 5. Deterministic 30 unique kids ───────────────────────────────────────
  const existingKids = await db.select({ id: kidsTable.id, name: kidsTable.name }).from(kidsTable).where(eq(kidsTable.doctorId, doctorId));
  if (existingKids.length > 0) {
    const existingKidIds = existingKids.map((k) => k.id);
    console.log(`Removing ${existingKidIds.length} existing kids for deterministic reseed...`);
    await db.delete(mealEntriesTable).where(inArray(mealEntriesTable.kidId, existingKidIds));
    await db.delete(ketoneReadingsTable).where(inArray(ketoneReadingsTable.kidId, existingKidIds));
    await db.delete(mealLogsTable).where(inArray(mealLogsTable.kidId, existingKidIds));
    const existingMealPlans = await db.select({ id: mealPlansTable.id }).from(mealPlansTable).where(inArray(mealPlansTable.kidId, existingKidIds));
    if (existingMealPlans.length > 0) {
      await db.delete(mealPlanItemsTable).where(inArray(mealPlanItemsTable.planId, existingMealPlans.map((p) => p.id)));
      await db.delete(mealPlansTable).where(inArray(mealPlansTable.kidId, existingKidIds));
    }
    await db.delete(notesTable).where(inArray(notesTable.kidId, existingKidIds));
    await db.delete(mealDaysTable).where(inArray(mealDaysTable.kidId, existingKidIds));
    await db.delete(weightRecordsTable).where(inArray(weightRecordsTable.kidId, existingKidIds));
    await db.delete(medicalSettingsTable).where(inArray(medicalSettingsTable.kidId, existingKidIds));
    await db.delete(kidsTable).where(inArray(kidsTable.id, existingKidIds));
  }

  const kidsData = [
    { name: "Emma Thompson",      dateOfBirth: "2019-03-15", gender: "female", parentName: "Mary Thompson",      parentContact: "+1-555-0101", dietType: "mad", dietSubCategory: null, baseWeight: 12.4 },
    { name: "Liam Carter",        dateOfBirth: "2018-07-22", gender: "male",   parentName: "John Carter",        parentContact: "+1-555-0102", dietType: "classic", dietSubCategory: "4:1", baseWeight: 14.8 },
    { name: "Olivia Martinez",    dateOfBirth: "2020-01-10", gender: "female", parentName: "Rosa Martinez",      parentContact: "+1-555-0103", dietType: "mct", dietSubCategory: null, baseWeight: 11.2 },
    { name: "Noah Williams",      dateOfBirth: "2017-11-05", gender: "male",   parentName: "James Williams",     parentContact: "+1-555-0104", dietType: "lowgi", dietSubCategory: null, baseWeight: 18.6 },
    { name: "Ava Brown",          dateOfBirth: "2019-09-28", gender: "female", parentName: "Lisa Brown",         parentContact: "+1-555-0105", dietType: "mad", dietSubCategory: null, baseWeight: 13.0 },
    { name: "Ethan Davis",        dateOfBirth: "2018-04-17", gender: "male",   parentName: "Robert Davis",       parentContact: "+44-7700-900106", dietType: "classic", dietSubCategory: "3:1", baseWeight: 15.2 },
    { name: "Sophia Wilson",      dateOfBirth: "2020-06-03", gender: "female", parentName: "Jennifer Wilson",    parentContact: "+1-555-0107", dietType: "mad", dietSubCategory: null, baseWeight: 10.8 },
    { name: "Mason Miller",       dateOfBirth: "2016-12-19", gender: "male",   parentName: "David Miller",       parentContact: "+1-555-0108", dietType: "mct", dietSubCategory: null, baseWeight: 20.4 },
    { name: "Isabella Moore",     dateOfBirth: "2019-05-11", gender: "female", parentName: "Sarah Moore",        parentContact: "+1-555-0109", dietType: "classic", dietSubCategory: "4:1", baseWeight: 13.6 },
    { name: "Lucas Taylor",       dateOfBirth: "2017-08-30", gender: "male",   parentName: "Mark Taylor",        parentContact: "+44-7700-900110", dietType: "lowgi", dietSubCategory: null, baseWeight: 19.2 },
    { name: "Mia Anderson",       dateOfBirth: "2021-02-14", gender: "female", parentName: "Karen Anderson",     parentContact: "+1-555-0111", dietType: "classic", dietSubCategory: "2:1", baseWeight: 9.4 },
    { name: "Aiden Jackson",      dateOfBirth: "2018-10-07", gender: "male",   parentName: "Paul Jackson",       parentContact: "+1-555-0112", dietType: "mad", dietSubCategory: null, baseWeight: 16.0 },
    { name: "Charlotte White",    dateOfBirth: "2020-04-22", gender: "female", parentName: "Nancy White",        parentContact: "+1-555-0113", dietType: "mct", dietSubCategory: null, baseWeight: 11.8 },
    { name: "James Harris",       dateOfBirth: "2017-01-18", gender: "male",   parentName: "Brian Harris",       parentContact: "+61-4-0000-0114", dietType: "lowgi", dietSubCategory: null, baseWeight: 21.0 },
    { name: "Amelia Clark",       dateOfBirth: "2019-12-09", gender: "female", parentName: "Susan Clark",        parentContact: "+1-555-0115", dietType: "mad", dietSubCategory: null, baseWeight: 13.8 },
    { name: "Henry Baker",        dateOfBirth: "2018-02-28", gender: "male",   parentName: "Tom Baker",          parentContact: "+1-555-0116", dietType: "classic", dietSubCategory: "4:1", baseWeight: 15.6 },
    { name: "Zoe Nguyen",         dateOfBirth: "2020-08-14", gender: "female", parentName: "Linh Nguyen",        parentContact: "+1-555-0117", dietType: "mct", dietSubCategory: null, baseWeight: 10.6 },
    { name: "Jack Robinson",      dateOfBirth: "2017-06-21", gender: "male",   parentName: "Steve Robinson",     parentContact: "+1-555-0118", dietType: "lowgi", dietSubCategory: null, baseWeight: 19.8 },
    { name: "Lily Patel",         dateOfBirth: "2019-11-03", gender: "female", parentName: "Priya Patel",        parentContact: "+44-7700-900119", dietType: "mad", dietSubCategory: null, baseWeight: 12.0 },
    { name: "Owen Kim",           dateOfBirth: "2021-04-09", gender: "male",   parentName: "Soo-Jin Kim",        parentContact: "+1-555-0120", dietType: "classic", dietSubCategory: "3.5:1", baseWeight: 9.8 },
    { name: "Ella Gonzalez",      dateOfBirth: "2018-09-17", gender: "female", parentName: "Maria Gonzalez",     parentContact: "+1-555-0121", dietType: "mct", dietSubCategory: null, baseWeight: 14.4 },
    { name: "Leo Murphy",         dateOfBirth: "2016-05-30", gender: "male",   parentName: "Sean Murphy",        parentContact: "+353-85-000122", dietType: "lowgi", dietSubCategory: null, baseWeight: 22.0 },
    { name: "Grace Chen",         dateOfBirth: "2020-12-01", gender: "female", parentName: "Wei Chen",           parentContact: "+1-555-0123", dietType: "classic", dietSubCategory: "2.5:1", baseWeight: 10.2 },
    { name: "Daniel Evans",       dateOfBirth: "2019-07-25", gender: "male",   parentName: "Craig Evans",        parentContact: "+44-7700-900124", dietType: "mad", dietSubCategory: null, baseWeight: 13.4 },
    { name: "Chloe Rivera",       dateOfBirth: "2017-03-12", gender: "female", parentName: "Ana Rivera",         parentContact: "+1-555-0125", dietType: "mct", dietSubCategory: null, baseWeight: 17.6 },
    { name: "Ryan Scott",         dateOfBirth: "2018-12-08", gender: "male",   parentName: "Kevin Scott",        parentContact: "+1-555-0126", dietType: "classic", dietSubCategory: "3:1", baseWeight: 14.0 },
    { name: "Hannah Lewis",       dateOfBirth: "2020-10-19", gender: "female", parentName: "Angela Lewis",       parentContact: "+1-555-0127", dietType: "mad", dietSubCategory: null, baseWeight: 11.4 },
    { name: "Caleb Walker",       dateOfBirth: "2016-08-06", gender: "male",   parentName: "Mike Walker",        parentContact: "+1-555-0128", dietType: "lowgi", dietSubCategory: null, baseWeight: 21.6 },
    { name: "Aria Sanchez",       dateOfBirth: "2021-01-23", gender: "female", parentName: "Carmen Sanchez",     parentContact: "+1-555-0129", dietType: "classic", dietSubCategory: "3.5:1", baseWeight: 9.0 },
    { name: "Benjamin Young",     dateOfBirth: "2019-04-02", gender: "male",   parentName: "Peter Young",        parentContact: "+61-4-0000-0130", dietType: "mct", dietSubCategory: null, baseWeight: 13.2 },
    { name: "Sofia Kowalski",     dateOfBirth: "2025-09-10", gender: "female", parentName: "Anna Kowalski",       parentContact: "+48-600-131-000", dietType: "classic", dietSubCategory: "2:1", baseWeight: 7.2 },
    { name: "Mateo Herrera",      dateOfBirth: "2021-07-04", gender: "male",   parentName: "Diego Herrera",       parentContact: "+52-55-1234-0132", dietType: "classic", dietSubCategory: "3:1", baseWeight: 10.5 },
    { name: "Isla MacPherson",    dateOfBirth: "2020-03-19", gender: "female", parentName: "Fiona MacPherson",    parentContact: "+44-7700-900133", dietType: "mad", dietSubCategory: null, baseWeight: 12.8 },
    { name: "Elijah Okafor",      dateOfBirth: "2017-10-26", gender: "male",   parentName: "Chidi Okafor",        parentContact: "+234-803-000-0134", dietType: "lowgi", dietSubCategory: null, baseWeight: 20.1 },
    { name: "Freya Larsson",      dateOfBirth: "2019-01-07", gender: "female", parentName: "Ingrid Larsson",      parentContact: "+46-70-000-0135", dietType: "mad", dietSubCategory: null, baseWeight: 13.5 },
    { name: "Kai Tanaka",         dateOfBirth: "2018-05-30", gender: "male",   parentName: "Yuki Tanaka",         parentContact: "+81-90-0000-0136", dietType: "mct", dietSubCategory: null, baseWeight: 16.4 },
    { name: "Nora Fitzgerald",    dateOfBirth: "2020-11-22", gender: "female", parentName: "Sinead Fitzgerald",   parentContact: "+353-85-000137", dietType: "classic", dietSubCategory: "2.5:1", baseWeight: 10.9 },
    { name: "Theo Müller",        dateOfBirth: "2016-09-14", gender: "male",   parentName: "Klaus Müller",        parentContact: "+49-170-000-0138", dietType: "lowgi", dietSubCategory: null, baseWeight: 22.8 },
    { name: "Aurora Singh",       dateOfBirth: "2021-12-05", gender: "female", parentName: "Gurpreet Singh",      parentContact: "+91-98-0000-0139", dietType: "classic", dietSubCategory: "3.5:1", baseWeight: 9.1 },
    { name: "Felix Dubois",       dateOfBirth: "2018-08-11", gender: "male",   parentName: "Pierre Dubois",       parentContact: "+33-6-00-00-0140", dietType: "mad", dietSubCategory: null, baseWeight: 15.7 },
    { name: "Penelope O'Brien",   dateOfBirth: "2019-06-27", gender: "female", parentName: "Aoife O'Brien",       parentContact: "+353-86-000141", dietType: "mct", dietSubCategory: null, baseWeight: 12.3 },
    { name: "Ryder Johansson",    dateOfBirth: "2017-02-15", gender: "male",   parentName: "Erik Johansson",      parentContact: "+46-70-000-0142", dietType: "lowgi", dietSubCategory: null, baseWeight: 19.5 },
    { name: "Imogen Papadopoulos",dateOfBirth: "2020-07-08", gender: "female", parentName: "Eleni Papadopoulos",  parentContact: "+30-697-000-0143", dietType: "mad", dietSubCategory: null, baseWeight: 11.6 },
    { name: "Axel Petrov",        dateOfBirth: "2018-03-21", gender: "male",   parentName: "Ivan Petrov",         parentContact: "+7-900-000-0144", dietType: "classic", dietSubCategory: "4:1", baseWeight: 14.3 },
    { name: "Luna Moreau",        dateOfBirth: "2021-10-13", gender: "female", parentName: "Claire Moreau",       parentContact: "+33-6-00-00-0145", dietType: "classic", dietSubCategory: "2:1", baseWeight: 8.8 },
    { name: "Jasper de Vries",    dateOfBirth: "2016-12-02", gender: "male",   parentName: "Willem de Vries",     parentContact: "+31-6-0000-0146", dietType: "mct", dietSubCategory: null, baseWeight: 23.1 },
    { name: "Sienna Russo",       dateOfBirth: "2019-08-18", gender: "female", parentName: "Giulia Russo",        parentContact: "+39-347-000-0147", dietType: "mad", dietSubCategory: null, baseWeight: 13.0 },
    { name: "Declan Walsh",       dateOfBirth: "2022-02-28", gender: "male",   parentName: "Patrick Walsh",       parentContact: "+353-87-000148", dietType: "classic", dietSubCategory: "3:1", baseWeight: 8.3 },
    { name: "Valentina Cruz",     dateOfBirth: "2018-01-09", gender: "female", parentName: "Isabel Cruz",         parentContact: "+34-6-0000-0149", dietType: "mct", dietSubCategory: null, baseWeight: 15.1 },
    { name: "Hamish Stewart",     dateOfBirth: "2017-05-24", gender: "male",   parentName: "Alistair Stewart",    parentContact: "+44-7700-900150", dietType: "lowgi", dietSubCategory: null, baseWeight: 20.8 },
    { name: "Margot Lefebvre",    dateOfBirth: "2020-09-30", gender: "female", parentName: "Brigitte Lefebvre",   parentContact: "+32-470-00-0151", dietType: "mad", dietSubCategory: null, baseWeight: 11.9 },
    { name: "Tobias Andersen",    dateOfBirth: "2025-06-17", gender: "male",   parentName: "Mikkel Andersen",     parentContact: "+45-22-000-152", dietType: "classic", dietSubCategory: "2.5:1", baseWeight: 6.9 },
  ];

  const completionRates = [
    0.90, 0.42, 0.85, 0.95, 0.28, 0.70, 0.88, 0.62, 0.75, 0.45,
    0.92, 0.55, 0.82, 0.38, 0.78, 0.65, 0.91, 0.50, 0.73, 0.88,
    0.35, 0.80, 0.60, 0.77, 0.85, 0.48, 0.70, 0.93, 0.55, 0.82,
    // new patients 31-52
    0.30, 0.67, 0.88, 0.25, 0.72, 0.40, 0.95, 0.58, 0.33, 0.84,
    0.45, 0.76, 0.52, 0.90, 0.38, 0.63, 0.87, 0.20, 0.70, 0.44,
    0.91, 0.29,
  ];

  const dietTypeSettings: Record<string, { ketoRatio: number; dailyCalories: number; dailyCarbs: number; dailyFat: number; dailyProtein: number }> = {
    classic: { ketoRatio: 4, dailyCalories: 1200, dailyCarbs: 15, dailyFat: 100, dailyProtein: 40 },
    mad:     { ketoRatio: 2, dailyCalories: 1400, dailyCarbs: 20, dailyFat: 100, dailyProtein: 50 },
    mct:     { ketoRatio: 3, dailyCalories: 1400, dailyCarbs: 20, dailyFat: 120, dailyProtein: 45 },
    lowgi:   { ketoRatio: 2, dailyCalories: 1600, dailyCarbs: 40, dailyFat: 80,  dailyProtein: 50 },
  };

  const createdKids: { id: number; dietType: string; dietSubCategory: string | null; name: string }[] = [];
  const usedPHNCodes = new Set<string>();

  for (const kid of kidsData) {
    const { baseWeight, ...kidFields } = kid;
    const [created] = await db
      .insert(kidsTable)
      .values({
        ...kidFields,
        kidCode: generatePHNCode(usedPHNCodes),
        doctorId,
      })
      .returning();
    if (created) createdKids.push({ ...created, name: kid.name });
  }

  for (let i = 0; i < createdKids.length; i++) {
    const kid = createdKids[i];
    const med = dietTypeSettings[kid.dietType] ?? dietTypeSettings["classic"];
    const baseWeight = kidsData[i].baseWeight;

    await db.insert(medicalSettingsTable).values({
      kidId: kid.id,
      dietType: kid.dietType,
      dietSubCategory: kid.dietSubCategory,
      ...med,
      showAllFoods: true,
      showAllRecipes: true,
    });

    // Weight records — 12 weekly entries with realistic progression
    for (let w = 0; w < 12; w++) {
      const date = new Date();
      date.setDate(date.getDate() - (11 - w) * 7);
      const trend = completionRates[i] > 0.7 ? 0.15 : -0.05;
      await db.insert(weightRecordsTable).values({
        kidId: kid.id,
        weight: Math.round((baseWeight + w * trend + (Math.random() - 0.5) * 0.2) * 10) / 10,
        date: date.toISOString().split("T")[0],
        note: w === 11 ? "Most recent clinic measurement" : w === 5 ? "Mid-protocol review" : null,
      });
    }

    // Ketone readings — 8 readings over the last 4 weeks
    const ketoneBase = kid.dietType === "mct" || kid.dietType === "lowgi" ? 3.2 : kid.dietType === "mad" ? 2.0 : 1.2;
    for (let k = 0; k < 8; k++) {
      const date = new Date();
      date.setDate(date.getDate() - k * 4);
      await db.insert(ketoneReadingsTable).values({
        kidId: kid.id,
        value: Math.round((ketoneBase + (Math.random() - 0.5) * 0.8) * 10) / 10,
        date: date.toISOString().split("T")[0],
        notes: k === 0 ? "Home monitoring reading" : null,
      }).catch(() => {});
    }

    // Meal days — 35 days
    const rate = completionRates[i] ?? 0.7;
    const carbMultipliers = [
      // Patients 1-30: multiplier * completionRate > 1.0 means "Not in Keto"
      // "In Keto" patients use 0.75 (safely below target)
      // "Not in Keto" patients use 1/rate * 1.2 (reliably 20% above target)
      0.75, 2.86, 0.75, 0.75, 4.29, 0.75, 0.75, 1.94, 0.75, 2.67,
      0.75, 2.18, 0.75, 3.16, 0.75, 0.75, 0.75, 2.40, 0.75, 0.75,
      3.43, 0.75, 2.00, 0.75, 0.75, 2.50, 0.75, 0.75, 2.18, 0.75,
      // Patients 31-52
      0.75, 1.79, 0.75, 0.75, 0.75, 3.00, 0.75, 2.07, 0.75, 0.75,
      2.67, 0.75, 2.31, 0.75, 3.16, 0.75, 0.75, 0.75, 0.75, 0.75,
      0.75, 0.75,
    ];
    const carbMultiplier = carbMultipliers[i] ?? 1.0;
    const filledDayCount = Math.round(35 * Math.min(rate + 0.1, 1.0));

    for (let d = 34; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const totalMeals = 5;
      const completedMeals = Math.max(0, Math.min(totalMeals, Math.round(totalMeals * rate + (Math.random() - 0.5))));
      const missedMeals = totalMeals - completedMeals;
      const dayCarbs = completedMeals > 0
        ? completedMeals * (med.dailyCarbs / totalMeals) * carbMultiplier + (Math.random() - 0.3) * 4
        : 0;
      await db.insert(mealDaysTable).values({
        kidId: kid.id,
        date: date.toISOString().split("T")[0],
        totalMeals,
        completedMeals,
        missedMeals,
        isFilled: d < filledDayCount,
        totalCalories: completedMeals * (med.dailyCalories / totalMeals),
        totalCarbs: Math.max(0, dayCarbs),
        totalFat: completedMeals * (med.dailyFat / totalMeals),
        totalProtein: completedMeals * (med.dailyProtein / totalMeals),
      });
    }

    // Meal logs within the last 24 hours for varied 24h completion rates
    const last24hRates = [
      0.80, 0.20, 1.00, 0.60, 0.00, 0.40, 0.80, 0.60, 1.00, 0.20,
      0.80, 0.40, 0.60, 0.00, 1.00, 0.60, 0.80, 0.20, 1.00, 0.40,
      0.00, 0.80, 0.60, 1.00, 0.40, 0.20, 0.80, 1.00, 0.60, 0.40,
      // new patients 31-52
      0.20, 0.80, 1.00, 0.00, 0.60, 0.40, 1.00, 0.60, 0.20, 0.80,
      0.40, 1.00, 0.00, 0.80, 0.20, 0.60, 1.00, 0.00, 0.80, 0.40,
      1.00, 0.20,
    ];
    const last24hRate = last24hRates[i] ?? 0.5;
    const mealTypes = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];
    for (let m = 0; m < mealTypes.length; m++) {
      const hoursAgo = 2 + m * 4;
      const logTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      const isCompleted = Math.random() < last24hRate;
      await db.insert(mealLogsTable).values({
        kidId: kid.id,
        date: logTime.toISOString().split("T")[0],
        mealType: mealTypes[m],
        isCompleted,
        calories: isCompleted ? med.dailyCalories / 5 : 0,
        carbs: isCompleted ? med.dailyCarbs / 5 : 0,
        fat: isCompleted ? med.dailyFat / 5 : 0,
        protein: isCompleted ? med.dailyProtein / 5 : 0,
        createdAt: logTime,
      });
    }
  }

  // Clinical notes for all kids
  const noteContents = [
    "Patient maintaining excellent keto compliance. Parents report good tolerance with no adverse GI effects. Continue current 3:1 protocol.",
    "Weight slightly below target range. Recommended calorie increase of 10%. Parents given revised meal plan guidance. Follow-up in 2 weeks.",
    "Seizure frequency reduced by 60% since initiating ketogenic therapy. Blood ketones consistently 3.0–4.2 mmol/L. Excellent therapeutic response.",
    "Parents experiencing meal prep difficulties. Referred to specialist dietitian for hands-on support session. Will reassess compliance at next visit.",
    "Blood ketone levels consistently above 2.0 mmol/L. Therapy is working well. Patient is alert and growing appropriately for age.",
    "New patient — completing Classic Ketogenic induction week. Family educated on carb counting and meal weighing. Tolerating diet well.",
    "MAD patient with stable seizure control. Slight weight gain this month, adjusting fat ratios accordingly.",
    "Increased ketone target to 3.5 mmol/L for better seizure control. Monitoring blood glucose for hypoglycemia risk.",
    "Classic Ketogenic patient showing improvement. First ketone reading of 1.8 mmol/L achieved. Parents very motivated and compliant.",
    "Low GI maintenance — patient doing well, transitioning slowly off strict keto. Carb allowance increased to 20g/day.",
    "Youngest patient in the program. Parents diligent with measurements. Ketones at 1.2 mmol/L — target range for Classic Ketogenic.",
    "Mid-protocol review: Good seizure reduction (approx 45%). Meal completion at 55%, needs improvement. Reviewed barriers with family.",
    "Seizure-free for 3 weeks following intensification to 4:1 ratio. Ketones averaging 3.8 mmol/L. Exceptional response.",
    "Longstanding keto patient — 4 years on diet. Considering weaning protocol. Will discuss with neurology team.",
    "Stable MAD patient. Parents report improved energy and concentration at school. Meal completion rate improving steadily.",
    "Classic Ketogenic induction progressing well. Urinary ketones detected day 3. Family adapting to meal weighing routine. No adverse symptoms reported.",
    "Patient on 4:1 ratio showing strong seizure control. Mild constipation reported — increased fiber via approved vegetables. Hydration counseling given.",
    "Low GI patient, 2 years on protocol. Growth velocity normal. Bone density scan scheduled. Continue current maintenance plan.",
    "MAD transition smooth. Ketone levels stable at 2.4 mmol/L. Parents confident with carb calculations. Next review in 4 weeks.",
    "Newest patient — just started Classic Ketogenic diet. Initial baseline labs completed. Family orientation session done. Meal plan distributed.",
    "Patient showing excellent 4:1 compliance. Seizure diary shows 80% reduction from baseline. Some food refusal — discussed strategies with parents.",
    "Long-term Low GI patient. Considering transition to Modified Atkins. EEG review pending. Diet well tolerated for 3+ years.",
    "Classic Ketogenic patient, week 2. Ketones rising to 1.5 mmol/L. Mild lethargy reported — advised on electrolyte supplementation.",
    "MAD patient with good adherence. Parents requesting more recipe variety. Shared additional keto recipe resources.",
    "High-ratio protocol (4:1) for refractory epilepsy. Blood glucose stable. Weight gain adequate. Continue current approach.",
    "Classic Ketogenic patient adapting slowly. Meal completion at 48%. Parents struggling with portion accuracy. Scheduled dietitian follow-up.",
    "MAD patient — steady improvement over 3 months. Ketones averaging 2.2 mmol/L. School nurse informed about diet requirements.",
    "Low GI maintenance — excellent long-term compliance. Annual labs within normal limits. Discuss potential weaning timeline at next visit.",
    "Youngest Classic Ketogenic patient. Very small portions. Parents extremely careful with measurements. Good ketone response at 1.3 mmol/L.",
    "MCT Diet intensification initiated. Increasing fat ratio from 3:1 to 4:1. Blood monitoring frequency increased to twice weekly.",
    "Very young patient at 6 months — diet introduced cautiously. Parents trained intensively on formula preparation. Daily monitoring in place.",
    "Classic Ketogenic patient, week 3. Slow start to compliance. Parents overwhelmed with meal weighing. Support group referral made.",
    "MAD patient with consistent 88% compliance. Excellent seizure control since diet initiation. Family very engaged with protocol.",
    "Diet poorly tolerated — GI symptoms reported. Considering 2:1 ratio as starting point. Labs ordered to assess electrolytes.",
    "MAD — steady progress. Patient alert and active at school. Blood ketones 2.1 mmol/L. Continue current plan.",
    "Compliance dipping at 40%. Family recently relocated, disrupting routine. Connecting with local dietitian for ongoing support.",
    "MCT Diet patient achieving 95% compliance. Seizures reduced from daily to twice weekly. Excellent prognosis for continued improvement.",
    "Mid-protocol review for MAD patient. Meal completion at 58%. Parents report difficulty with school lunches. Created portable meal guide.",
    "Patient flagged High Risk — completion below 60%. Emergency review scheduled. Parents contacted via phone. Dietitian follow-up booked.",
    "MAD patient with 84% compliance. Growing steadily. Blood glucose within target. Continue 3:1 protocol.",
    "MCT Diet — initial results encouraging. First two weeks on strict 4:1. Ketones reaching 3.0 mmol/L. Mild irritability noted, likely transitional.",
    "Classic Ketogenic patient, day 18. Low-carb adaptation progressing. Urinary ketones positive since day 5. Parents diligent with journaling.",
    "Low GI maintenance. Patient on diet for 2.5 years. Transition plan drafted in collaboration with neurology. Gradual carb increase planned.",
    "Compliance suddenly dropped to 38%. Parents report child refusing some keto foods. Flavour variety session held with dietitian.",
    "MAD — consistent 63% completion rate. Aiming for 75% by next review. Family attending monthly group clinic sessions.",
    "MCT Diet with strong 87% compliance. Bloodwork excellent — no deficiencies detected. Parents highly confident with meal preparation.",
    "High-risk alert — 20% completion. Family crisis situation identified. Social worker involved. Diet temporarily simplified to aid compliance.",
    "MAD patient performing well overall. Ketones stable. Parents keen to progress to MCT Diet. Discussed timeline and criteria with family.",
    "Classic Ketogenic patient at 44% completion. Recently diagnosed; family still in adjustment period. Weekly check-in calls arranged with clinic nurse.",
    "MCT Diet patient exceeding targets at 91% compliance. Seizure diary shows 75% reduction. Discussed potential weaning in 6 months.",
    "High-risk patient. Completion at 29%. Multiple missed days identified in meal log review. Intensive support package initiated with family.",
    "Infant patient (6 months). Diet introduced under close supervision. Formula-based ketogenic plan active. Ketones 0.8 mmol/L at day 10.",
  ];

  for (let i = 0; i < createdKids.length; i++) {
    await db.insert(notesTable).values({
      kidId: createdKids[i].id,
      doctorId,
      doctorName: "Dr. Sarah Johnson",
      content: noteContents[i] ?? "Regular monitoring note. Patient progressing as expected.",
    });
  }

  console.log(`Kids seeded: ${createdKids.length} total`);

  // ── 6. Seed 30 keto recipes with ingredients ─────────────────────────────
  const existingRecipes = await db.select({ id: recipesTable.id }).from(recipesTable).where(eq(recipesTable.doctorId, doctorId));
  if (existingRecipes.length > 0) {
    const existingRecipeIds = existingRecipes.map((r) => r.id);
    await db.delete(recipeIngredientsTable).where(inArray(recipeIngredientsTable.recipeId, existingRecipeIds));
    await db.delete(recipesTable).where(inArray(recipesTable.id, existingRecipeIds));
    console.log(`Removed ${existingRecipeIds.length} existing recipes for deterministic reseed...`);
  }

  const recipesData: { name: string; description: string; category: string; ingredients: { foodName: string; portionGrams: number; unit: string; carbs: number; fat: number; protein: number; calories: number }[] }[] = [
    {
      name: "Keto Bacon Egg Cups",
      description: "Crispy bacon cups filled with baked eggs and cheese — a perfect high-fat breakfast.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Bacon", portionGrams: 60, unit: "g", carbs: 0.4, fat: 25, protein: 22, calories: 325 },
        { foodName: "Whole Eggs", portionGrams: 100, unit: "g", carbs: 0.6, fat: 10, protein: 13, calories: 155 },
        { foodName: "Cheddar Cheese", portionGrams: 20, unit: "g", carbs: 0.3, fat: 6.6, protein: 5, calories: 81 },
      ],
    },
    {
      name: "Creamy Spinach Chicken",
      description: "Pan-seared chicken thighs smothered in a creamy spinach and parmesan sauce.",
      category: "Main Course",
      ingredients: [
        { foodName: "Chicken Thigh", portionGrams: 150, unit: "g", carbs: 0, fat: 13.5, protein: 39, calories: 314 },
        { foodName: "Spinach", portionGrams: 80, unit: "g", carbs: 1.1, fat: 0.3, protein: 2.3, calories: 18 },
        { foodName: "Heavy Cream", portionGrams: 40, unit: "g", carbs: 1.4, fat: 14, protein: 0.8, calories: 136 },
        { foodName: "Parmesan", portionGrams: 15, unit: "g", carbs: 0.5, fat: 4.4, protein: 5.7, calories: 65 },
      ],
    },
    {
      name: "MCT Fat Bombs",
      description: "No-bake chocolate fat bombs with MCT oil and coconut for rapid ketone production.",
      category: "Snack",
      ingredients: [
        { foodName: "MCT Oil", portionGrams: 20, unit: "g", carbs: 0, fat: 20, protein: 0, calories: 172 },
        { foodName: "Coconut Oil", portionGrams: 15, unit: "g", carbs: 0, fat: 15, protein: 0, calories: 129 },
        { foodName: "Almond Butter", portionGrams: 20, unit: "g", carbs: 1.4, fat: 10, protein: 4.2, calories: 123 },
      ],
    },
    {
      name: "Cauliflower Mac and Cheese",
      description: "Steamed cauliflower baked in a rich cheddar and cream cheese sauce — kid-friendly comfort food.",
      category: "Main Course",
      ingredients: [
        { foodName: "Cauliflower", portionGrams: 150, unit: "g", carbs: 7.5, fat: 0.5, protein: 2.9, calories: 38 },
        { foodName: "Cheddar Cheese", portionGrams: 40, unit: "g", carbs: 0.5, fat: 13.2, protein: 10, calories: 161 },
        { foodName: "Cream Cheese", portionGrams: 30, unit: "g", carbs: 1.2, fat: 9.9, protein: 1.8, calories: 103 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
    {
      name: "Salmon Avocado Bowl",
      description: "Flaked baked salmon served over sliced avocado with olive oil drizzle.",
      category: "Main Course",
      ingredients: [
        { foodName: "Salmon", portionGrams: 140, unit: "g", carbs: 0, fat: 18.2, protein: 35, calories: 291 },
        { foodName: "Avocado", portionGrams: 80, unit: "g", carbs: 1.6, fat: 12, protein: 1.6, calories: 128 },
        { foodName: "Olive Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 88 },
      ],
    },
    {
      name: "Keto Pancakes",
      description: "Fluffy almond flour pancakes with cream cheese batter — a breakfast treat.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Almond Flour", portionGrams: 40, unit: "g", carbs: 4, fat: 21.6, protein: 9.6, calories: 230 },
        { foodName: "Cream Cheese", portionGrams: 30, unit: "g", carbs: 1.2, fat: 9.9, protein: 1.8, calories: 103 },
        { foodName: "Whole Eggs", portionGrams: 50, unit: "g", carbs: 0.3, fat: 5, protein: 6.5, calories: 78 },
        { foodName: "Butter", portionGrams: 15, unit: "g", carbs: 0, fat: 12.2, protein: 0.1, calories: 108 },
      ],
    },
    {
      name: "Beef and Broccoli Stir-Fry",
      description: "Tender ground beef with broccoli florets cooked in avocado oil.",
      category: "Main Course",
      ingredients: [
        { foodName: "Ground Beef", portionGrams: 150, unit: "g", carbs: 0, fat: 30, protein: 39, calories: 431 },
        { foodName: "Broccoli", portionGrams: 100, unit: "g", carbs: 4, fat: 0.4, protein: 2.6, calories: 34 },
        { foodName: "Avocado Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 88 },
      ],
    },
    {
      name: "Cheesy Zucchini Boats",
      description: "Hollowed zucchini stuffed with seasoned ground beef and melted mozzarella.",
      category: "Main Course",
      ingredients: [
        { foodName: "Zucchini", portionGrams: 200, unit: "g", carbs: 6.2, fat: 0.6, protein: 2.4, calories: 34 },
        { foodName: "Ground Beef", portionGrams: 100, unit: "g", carbs: 0, fat: 20, protein: 26, calories: 287 },
        { foodName: "Mozzarella", portionGrams: 40, unit: "g", carbs: 0.9, fat: 8.8, protein: 8.8, calories: 112 },
      ],
    },
    {
      name: "Keto Chicken Nuggets",
      description: "Crispy almond flour-coated chicken breast nuggets baked until golden — a kid favorite.",
      category: "Main Course",
      ingredients: [
        { foodName: "Chicken Breast", portionGrams: 150, unit: "g", carbs: 0, fat: 5.4, protein: 46.5, calories: 248 },
        { foodName: "Almond Flour", portionGrams: 30, unit: "g", carbs: 3, fat: 16.2, protein: 7.2, calories: 173 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
    {
      name: "Pork Belly Bites",
      description: "Crispy roasted pork belly cubes seasoned with salt and herbs — ultra high-fat snack.",
      category: "Snack",
      ingredients: [
        { foodName: "Pork Belly", portionGrams: 120, unit: "g", carbs: 0, fat: 63.6, protein: 10.8, calories: 622 },
        { foodName: "Olive Oil", portionGrams: 5, unit: "g", carbs: 0, fat: 5, protein: 0, calories: 44 },
      ],
    },
    {
      name: "Egg Drop Soup",
      description: "Simple and warming egg drop soup with spinach in a rich chicken broth base.",
      category: "Soup",
      ingredients: [
        { foodName: "Whole Eggs", portionGrams: 100, unit: "g", carbs: 0.6, fat: 10, protein: 13, calories: 155 },
        { foodName: "Spinach", portionGrams: 50, unit: "g", carbs: 0.7, fat: 0.2, protein: 1.5, calories: 12 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
    {
      name: "Lamb Chops with Herb Butter",
      description: "Grilled lamb chops served with a rich herb-infused butter topping.",
      category: "Main Course",
      ingredients: [
        { foodName: "Lamb Chops", portionGrams: 180, unit: "g", carbs: 0, fat: 43.2, protein: 45, calories: 567 },
        { foodName: "Butter", portionGrams: 20, unit: "g", carbs: 0, fat: 16.2, protein: 0.2, calories: 143 },
        { foodName: "Asparagus", portionGrams: 80, unit: "g", carbs: 3.1, fat: 0.1, protein: 1.8, calories: 16 },
      ],
    },
    {
      name: "Tuna Salad Lettuce Wraps",
      description: "Creamy tuna salad served in crisp lettuce cups with avocado.",
      category: "Lunch",
      ingredients: [
        { foodName: "Tuna", portionGrams: 120, unit: "g", carbs: 0, fat: 6, protein: 30, calories: 158 },
        { foodName: "Lettuce", portionGrams: 60, unit: "g", carbs: 1.4, fat: 0.2, protein: 0.7, calories: 10 },
        { foodName: "Avocado", portionGrams: 50, unit: "g", carbs: 1, fat: 7.5, protein: 1, calories: 80 },
        { foodName: "Olive Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 88 },
      ],
    },
    {
      name: "Keto Pizza Bites",
      description: "Mini pizza bites on an almond flour crust with mozzarella and peppers.",
      category: "Snack",
      ingredients: [
        { foodName: "Almond Flour", portionGrams: 30, unit: "g", carbs: 3, fat: 16.2, protein: 7.2, calories: 173 },
        { foodName: "Mozzarella", portionGrams: 50, unit: "g", carbs: 1.1, fat: 11, protein: 11, calories: 140 },
        { foodName: "Bell Pepper", portionGrams: 30, unit: "g", carbs: 1.4, fat: 0.1, protein: 0.3, calories: 6 },
      ],
    },
    {
      name: "Creamy Mushroom Soup",
      description: "Velvety mushroom soup made with heavy cream and butter — warming and keto-friendly.",
      category: "Soup",
      ingredients: [
        { foodName: "Mushrooms", portionGrams: 150, unit: "g", carbs: 5, fat: 0.5, protein: 4.7, calories: 33 },
        { foodName: "Heavy Cream", portionGrams: 60, unit: "g", carbs: 2, fat: 21, protein: 1.3, calories: 204 },
        { foodName: "Butter", portionGrams: 15, unit: "g", carbs: 0, fat: 12.2, protein: 0.1, calories: 108 },
      ],
    },
    {
      name: "Duck with Cabbage Slaw",
      description: "Roasted duck leg with a tangy cabbage and walnut slaw.",
      category: "Main Course",
      ingredients: [
        { foodName: "Duck", portionGrams: 160, unit: "g", carbs: 0, fat: 44.8, protein: 30.4, calories: 539 },
        { foodName: "Cabbage", portionGrams: 80, unit: "g", carbs: 4.6, fat: 0.1, protein: 1, calories: 20 },
        { foodName: "Walnuts", portionGrams: 20, unit: "g", carbs: 1.4, fat: 13, protein: 3, calories: 131 },
      ],
    },
    {
      name: "Mackerel Patties",
      description: "Pan-fried mackerel patties bound with egg and almond flour — omega-3 packed.",
      category: "Main Course",
      ingredients: [
        { foodName: "Mackerel", portionGrams: 140, unit: "g", carbs: 0, fat: 18.2, protein: 26.6, calories: 287 },
        { foodName: "Whole Eggs", portionGrams: 50, unit: "g", carbs: 0.3, fat: 5, protein: 6.5, calories: 78 },
        { foodName: "Almond Flour", portionGrams: 15, unit: "g", carbs: 1.5, fat: 8.1, protein: 3.6, calories: 86 },
        { foodName: "Coconut Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 86 },
      ],
    },
    {
      name: "Ribeye Steak with Butter",
      description: "Seared beef ribeye topped with melted herb butter — a classic high-fat keto dinner.",
      category: "Main Course",
      ingredients: [
        { foodName: "Beef Ribeye", portionGrams: 200, unit: "g", carbs: 0, fat: 74, protein: 54, calories: 900 },
        { foodName: "Butter", portionGrams: 20, unit: "g", carbs: 0, fat: 16.2, protein: 0.2, calories: 143 },
      ],
    },
    {
      name: "Shrimp Scampi",
      description: "Garlic butter shrimp served with sauteed zucchini noodles.",
      category: "Main Course",
      ingredients: [
        { foodName: "Shrimp", portionGrams: 150, unit: "g", carbs: 1.4, fat: 2.1, protein: 36, calories: 159 },
        { foodName: "Butter", portionGrams: 20, unit: "g", carbs: 0, fat: 16.2, protein: 0.2, calories: 143 },
        { foodName: "Zucchini", portionGrams: 100, unit: "g", carbs: 3.1, fat: 0.3, protein: 1.2, calories: 17 },
      ],
    },
    {
      name: "Keto Granola",
      description: "Crunchy homemade granola with pecans, chia seeds, and coconut flakes.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Pecans", portionGrams: 30, unit: "g", carbs: 1.2, fat: 21.6, protein: 2.7, calories: 207 },
        { foodName: "Chia Seeds", portionGrams: 15, unit: "g", carbs: 0.9, fat: 4.7, protein: 2.6, calories: 73 },
        { foodName: "Coconut Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 86 },
        { foodName: "Coconut Meat", portionGrams: 20, unit: "g", carbs: 1.2, fat: 7, protein: 0.7, calories: 71 },
      ],
    },
    {
      name: "Cod with Lemon Butter",
      description: "Baked cod fillets drizzled with lemon butter and served with green beans.",
      category: "Main Course",
      ingredients: [
        { foodName: "Cod", portionGrams: 150, unit: "g", carbs: 0, fat: 1.1, protein: 27, calories: 123 },
        { foodName: "Butter", portionGrams: 20, unit: "g", carbs: 0, fat: 16.2, protein: 0.2, calories: 143 },
        { foodName: "Green Beans", portionGrams: 80, unit: "g", carbs: 5.6, fat: 0.1, protein: 1.4, calories: 25 },
      ],
    },
    {
      name: "Keto Egg Muffins",
      description: "Baked egg muffins loaded with mushrooms, spinach, and cheddar cheese.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Whole Eggs", portionGrams: 120, unit: "g", carbs: 0.7, fat: 12, protein: 15.6, calories: 186 },
        { foodName: "Mushrooms", portionGrams: 40, unit: "g", carbs: 1.3, fat: 0.1, protein: 1.2, calories: 9 },
        { foodName: "Spinach", portionGrams: 30, unit: "g", carbs: 0.4, fat: 0.1, protein: 0.9, calories: 7 },
        { foodName: "Cheddar Cheese", portionGrams: 25, unit: "g", carbs: 0.3, fat: 8.3, protein: 6.3, calories: 101 },
      ],
    },
    {
      name: "Turkey and Avocado Roll-Ups",
      description: "Sliced turkey breast wrapped around avocado and cream cheese — a quick keto lunch.",
      category: "Lunch",
      ingredients: [
        { foodName: "Turkey Breast", portionGrams: 100, unit: "g", carbs: 0, fat: 1, protein: 29, calories: 135 },
        { foodName: "Avocado", portionGrams: 60, unit: "g", carbs: 1.2, fat: 9, protein: 1.2, calories: 96 },
        { foodName: "Cream Cheese", portionGrams: 25, unit: "g", carbs: 1, fat: 8.3, protein: 1.5, calories: 86 },
      ],
    },
    {
      name: "Sardine Salad",
      description: "Protein-packed sardines served over a bed of mixed greens with olive oil dressing.",
      category: "Lunch",
      ingredients: [
        { foodName: "Sardines", portionGrams: 100, unit: "g", carbs: 0, fat: 11, protein: 25, calories: 208 },
        { foodName: "Lettuce", portionGrams: 60, unit: "g", carbs: 1.4, fat: 0.2, protein: 0.7, calories: 10 },
        { foodName: "Olive Oil", portionGrams: 15, unit: "g", carbs: 0, fat: 15, protein: 0, calories: 133 },
        { foodName: "Cucumber", portionGrams: 50, unit: "g", carbs: 1.8, fat: 0.1, protein: 0.4, calories: 8 },
      ],
    },
    {
      name: "Keto Berry Smoothie",
      description: "Thick and creamy smoothie with raspberries, heavy cream, and MCT oil.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Raspberries", portionGrams: 40, unit: "g", carbs: 2.2, fat: 0.3, protein: 0.5, calories: 21 },
        { foodName: "Heavy Cream", portionGrams: 60, unit: "g", carbs: 2, fat: 21, protein: 1.3, calories: 204 },
        { foodName: "MCT Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 86 },
      ],
    },
    {
      name: "Flaxseed Keto Bread",
      description: "Hearty low-carb bread made with flaxseed meal and eggs — perfect for toast.",
      category: "Side",
      ingredients: [
        { foodName: "Flaxseed Meal", portionGrams: 60, unit: "g", carbs: 1.2, fat: 5.4, protein: 3, calories: 84 },
        { foodName: "Whole Eggs", portionGrams: 50, unit: "g", carbs: 0.3, fat: 5, protein: 6.5, calories: 78 },
        { foodName: "Butter", portionGrams: 15, unit: "g", carbs: 0, fat: 12.2, protein: 0.1, calories: 108 },
      ],
    },
    {
      name: "Eggplant Parmesan",
      description: "Sliced eggplant baked with mozzarella and parmesan — a keto-friendly Italian classic.",
      category: "Main Course",
      ingredients: [
        { foodName: "Eggplant", portionGrams: 150, unit: "g", carbs: 8.9, fat: 0.3, protein: 1.5, calories: 38 },
        { foodName: "Mozzarella", portionGrams: 50, unit: "g", carbs: 1.1, fat: 11, protein: 11, calories: 140 },
        { foodName: "Parmesan", portionGrams: 20, unit: "g", carbs: 0.6, fat: 5.8, protein: 7.6, calories: 86 },
        { foodName: "Olive Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 88 },
      ],
    },
    {
      name: "Keto Chia Pudding",
      description: "Overnight chia seed pudding made with heavy cream and topped with blackberries.",
      category: "Dessert",
      ingredients: [
        { foodName: "Chia Seeds", portionGrams: 25, unit: "g", carbs: 1.5, fat: 7.8, protein: 4.3, calories: 122 },
        { foodName: "Heavy Cream", portionGrams: 80, unit: "g", carbs: 2.7, fat: 28, protein: 1.7, calories: 272 },
        { foodName: "Blackberries", portionGrams: 30, unit: "g", carbs: 1.5, fat: 0.2, protein: 0.4, calories: 13 },
      ],
    },
    {
      name: "Pecan Crusted Chicken",
      description: "Chicken breast coated in crushed pecans and baked until crispy.",
      category: "Main Course",
      ingredients: [
        { foodName: "Chicken Breast", portionGrams: 150, unit: "g", carbs: 0, fat: 5.4, protein: 46.5, calories: 248 },
        { foodName: "Pecans", portionGrams: 30, unit: "g", carbs: 1.2, fat: 21.6, protein: 2.7, calories: 207 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
        { foodName: "Whole Eggs", portionGrams: 50, unit: "g", carbs: 0.3, fat: 5, protein: 6.5, calories: 78 },
      ],
    },
    {
      name: "Greek Yogurt Keto Bowl",
      description: "Full-fat Greek yogurt topped with hemp seeds, flaxseeds, and a drizzle of MCT oil.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Greek Yogurt", portionGrams: 120, unit: "g", carbs: 4.9, fat: 6, protein: 10.8, calories: 116 },
        { foodName: "Hemp Seeds", portionGrams: 15, unit: "g", carbs: 0.5, fat: 7.4, protein: 4.8, calories: 83 },
        { foodName: "Flaxseeds", portionGrams: 10, unit: "g", carbs: 0.3, fat: 4.2, protein: 1.8, calories: 53 },
        { foodName: "MCT Oil", portionGrams: 5, unit: "g", carbs: 0, fat: 5, protein: 0, calories: 43 },
      ],
    },
    // ── New recipes (aiming for 50+ total) ──────────────────────────────────
    {
      name: "Almond Butter Fat Bombs",
      description: "Frozen almond butter and coconut oil bites — a quick morning snack loaded with healthy fats.",
      category: "Snack",
      ingredients: [
        { foodName: "Almond Butter", portionGrams: 30, unit: "g", carbs: 2.1, fat: 15, protein: 6.3, calories: 184 },
        { foodName: "Coconut Oil", portionGrams: 15, unit: "g", carbs: 0, fat: 15, protein: 0, calories: 129 },
        { foodName: "MCT Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 86 },
      ],
    },
    {
      name: "Keto Avocado Toast",
      description: "Creamy mashed avocado on flaxseed keto bread with a soft-boiled egg on top.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Avocado", portionGrams: 80, unit: "g", carbs: 1.6, fat: 12, protein: 1.6, calories: 128 },
        { foodName: "Flaxseed Meal", portionGrams: 40, unit: "g", carbs: 0.8, fat: 3.6, protein: 2, calories: 56 },
        { foodName: "Whole Eggs", portionGrams: 50, unit: "g", carbs: 0.3, fat: 5, protein: 6.5, calories: 78 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
    {
      name: "Bacon and Cheddar Omelette",
      description: "Fluffy omelette filled with crispy bacon bits and melted cheddar cheese.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Whole Eggs", portionGrams: 150, unit: "g", carbs: 0.9, fat: 15, protein: 19.5, calories: 233 },
        { foodName: "Bacon", portionGrams: 40, unit: "g", carbs: 0.3, fat: 16.8, protein: 14.8, calories: 216 },
        { foodName: "Cheddar Cheese", portionGrams: 30, unit: "g", carbs: 0.4, fat: 9.9, protein: 7.5, calories: 121 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
    {
      name: "Spinach and Feta Scramble",
      description: "Creamy scrambled eggs with wilted spinach and crumbled feta-style cheese.",
      category: "Breakfast",
      ingredients: [
        { foodName: "Whole Eggs", portionGrams: 120, unit: "g", carbs: 0.7, fat: 12, protein: 15.6, calories: 186 },
        { foodName: "Spinach", portionGrams: 60, unit: "g", carbs: 0.8, fat: 0.2, protein: 1.7, calories: 14 },
        { foodName: "Cream Cheese", portionGrams: 25, unit: "g", carbs: 1, fat: 8.3, protein: 1.5, calories: 86 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
    {
      name: "Macadamia Nut Clusters",
      description: "Bite-sized clusters of macadamia nuts coated in coconut oil — zero prep, maximum fat.",
      category: "Snack",
      ingredients: [
        { foodName: "Macadamia Nuts", portionGrams: 35, unit: "g", carbs: 1.8, fat: 26.6, protein: 2.8, calories: 251 },
        { foodName: "Coconut Oil", portionGrams: 5, unit: "g", carbs: 0, fat: 5, protein: 0, calories: 43 },
      ],
    },
    {
      name: "Cucumber Cream Cheese Bites",
      description: "Sliced cucumber rounds topped with herb cream cheese — a refreshing low-carb snack.",
      category: "Snack",
      ingredients: [
        { foodName: "Cucumber", portionGrams: 80, unit: "g", carbs: 2.9, fat: 0.1, protein: 0.6, calories: 12 },
        { foodName: "Cream Cheese", portionGrams: 40, unit: "g", carbs: 1.6, fat: 13.2, protein: 2.4, calories: 137 },
      ],
    },
    {
      name: "Deviled Eggs",
      description: "Classic deviled eggs filled with yolk, mayo-style cream cheese, and a sprinkle of paprika.",
      category: "Snack",
      ingredients: [
        { foodName: "Whole Eggs", portionGrams: 120, unit: "g", carbs: 0.7, fat: 12, protein: 15.6, calories: 186 },
        { foodName: "Cream Cheese", portionGrams: 20, unit: "g", carbs: 0.8, fat: 6.6, protein: 1.2, calories: 68 },
        { foodName: "Olive Oil", portionGrams: 5, unit: "g", carbs: 0, fat: 5, protein: 0, calories: 44 },
      ],
    },
    {
      name: "Keto Cauliflower Soup",
      description: "Velvety blended cauliflower soup enriched with butter and cream cheese.",
      category: "Soup",
      ingredients: [
        { foodName: "Cauliflower", portionGrams: 200, unit: "g", carbs: 10, fat: 0.6, protein: 3.8, calories: 50 },
        { foodName: "Heavy Cream", portionGrams: 50, unit: "g", carbs: 1.7, fat: 17.5, protein: 1.1, calories: 170 },
        { foodName: "Butter", portionGrams: 15, unit: "g", carbs: 0, fat: 12.2, protein: 0.1, calories: 108 },
        { foodName: "Cream Cheese", portionGrams: 20, unit: "g", carbs: 0.8, fat: 6.6, protein: 1.2, calories: 68 },
      ],
    },
    {
      name: "Broccoli Cheddar Soup",
      description: "Rich and comforting broccoli soup melted with cheddar and heavy cream.",
      category: "Soup",
      ingredients: [
        { foodName: "Broccoli", portionGrams: 150, unit: "g", carbs: 6, fat: 0.6, protein: 3.9, calories: 51 },
        { foodName: "Cheddar Cheese", portionGrams: 60, unit: "g", carbs: 0.8, fat: 19.8, protein: 15, calories: 242 },
        { foodName: "Heavy Cream", portionGrams: 60, unit: "g", carbs: 2, fat: 21, protein: 1.3, calories: 204 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
    {
      name: "Avocado Spinach Soup",
      description: "Cold blended avocado and spinach soup with olive oil — a nutrient-dense keto lunch.",
      category: "Soup",
      ingredients: [
        { foodName: "Avocado", portionGrams: 100, unit: "g", carbs: 2, fat: 15, protein: 2, calories: 160 },
        { foodName: "Spinach", portionGrams: 80, unit: "g", carbs: 1.1, fat: 0.3, protein: 2.3, calories: 18 },
        { foodName: "Olive Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 88 },
        { foodName: "Heavy Cream", portionGrams: 30, unit: "g", carbs: 1, fat: 10.5, protein: 0.6, calories: 102 },
      ],
    },
    {
      name: "Asparagus with Hollandaise",
      description: "Steamed asparagus spears with a rich egg yolk and butter hollandaise sauce.",
      category: "Side",
      ingredients: [
        { foodName: "Asparagus", portionGrams: 150, unit: "g", carbs: 5.9, fat: 0.2, protein: 3.3, calories: 30 },
        { foodName: "Egg Yolks", portionGrams: 30, unit: "g", carbs: 1.1, fat: 8.1, protein: 4.8, calories: 97 },
        { foodName: "Butter", portionGrams: 25, unit: "g", carbs: 0, fat: 20.3, protein: 0.2, calories: 179 },
      ],
    },
    {
      name: "Garlic Butter Green Beans",
      description: "Tender green beans sautéed in garlic-infused butter and parmesan.",
      category: "Side",
      ingredients: [
        { foodName: "Green Beans", portionGrams: 120, unit: "g", carbs: 8.4, fat: 0.1, protein: 2.2, calories: 37 },
        { foodName: "Butter", portionGrams: 20, unit: "g", carbs: 0, fat: 16.2, protein: 0.2, calories: 143 },
        { foodName: "Parmesan", portionGrams: 15, unit: "g", carbs: 0.5, fat: 4.4, protein: 5.7, calories: 65 },
      ],
    },
    {
      name: "Cauliflower Rice Pilaf",
      description: "Grated cauliflower sautéed in butter and seasoned as a keto rice substitute.",
      category: "Side",
      ingredients: [
        { foodName: "Cauliflower", portionGrams: 180, unit: "g", carbs: 9, fat: 0.5, protein: 3.4, calories: 45 },
        { foodName: "Butter", portionGrams: 20, unit: "g", carbs: 0, fat: 16.2, protein: 0.2, calories: 143 },
        { foodName: "Olive Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 88 },
      ],
    },
    {
      name: "Keto Almond Flour Cookies",
      description: "Soft baked almond flour cookies with macadamia nuts — a keto-friendly dessert treat.",
      category: "Dessert",
      ingredients: [
        { foodName: "Almond Flour", portionGrams: 60, unit: "g", carbs: 6, fat: 32.4, protein: 14.4, calories: 346 },
        { foodName: "Macadamia Nuts", portionGrams: 20, unit: "g", carbs: 1, fat: 15.2, protein: 1.6, calories: 144 },
        { foodName: "Butter", portionGrams: 20, unit: "g", carbs: 0, fat: 16.2, protein: 0.2, calories: 143 },
        { foodName: "Whole Eggs", portionGrams: 25, unit: "g", carbs: 0.2, fat: 2.5, protein: 3.3, calories: 39 },
      ],
    },
    {
      name: "Berry Cream Parfait",
      description: "Layered whipped heavy cream with mixed berries — an elegant keto dessert.",
      category: "Dessert",
      ingredients: [
        { foodName: "Heavy Cream", portionGrams: 80, unit: "g", carbs: 2.7, fat: 28, protein: 1.7, calories: 272 },
        { foodName: "Blueberries", portionGrams: 20, unit: "g", carbs: 2.4, fat: 0.1, protein: 0.1, calories: 11 },
        { foodName: "Raspberries", portionGrams: 20, unit: "g", carbs: 1.1, fat: 0.1, protein: 0.2, calories: 10 },
        { foodName: "Strawberries", portionGrams: 20, unit: "g", carbs: 1.5, fat: 0.1, protein: 0.1, calories: 6 },
      ],
    },
    {
      name: "Coconut Cream Pudding",
      description: "Thick coconut pudding made with coconut meat and heavy cream — dairy-optional keto dessert.",
      category: "Dessert",
      ingredients: [
        { foodName: "Coconut Meat", portionGrams: 50, unit: "g", carbs: 3, fat: 17.5, protein: 1.7, calories: 177 },
        { foodName: "Heavy Cream", portionGrams: 60, unit: "g", carbs: 2, fat: 21, protein: 1.3, calories: 204 },
        { foodName: "MCT Oil", portionGrams: 10, unit: "g", carbs: 0, fat: 10, protein: 0, calories: 86 },
      ],
    },
    {
      name: "BLT Lettuce Cups",
      description: "Bacon, sliced tomato-free BLT served in crisp romaine lettuce with cream cheese spread.",
      category: "Lunch",
      ingredients: [
        { foodName: "Bacon", portionGrams: 50, unit: "g", carbs: 0.4, fat: 21, protein: 18.5, calories: 271 },
        { foodName: "Lettuce", portionGrams: 80, unit: "g", carbs: 1.9, fat: 0.2, protein: 1, calories: 14 },
        { foodName: "Cream Cheese", portionGrams: 25, unit: "g", carbs: 1, fat: 8.3, protein: 1.5, calories: 86 },
        { foodName: "Avocado", portionGrams: 50, unit: "g", carbs: 1, fat: 7.5, protein: 1, calories: 80 },
      ],
    },
    {
      name: "Shrimp and Avocado Salad",
      description: "Juicy shrimp tossed with avocado and cucumber in an olive oil dressing.",
      category: "Lunch",
      ingredients: [
        { foodName: "Shrimp", portionGrams: 120, unit: "g", carbs: 1.1, fat: 1.7, protein: 28.8, calories: 127 },
        { foodName: "Avocado", portionGrams: 80, unit: "g", carbs: 1.6, fat: 12, protein: 1.6, calories: 128 },
        { foodName: "Cucumber", portionGrams: 60, unit: "g", carbs: 2.2, fat: 0.1, protein: 0.4, calories: 9 },
        { foodName: "Olive Oil", portionGrams: 15, unit: "g", carbs: 0, fat: 15, protein: 0, calories: 133 },
      ],
    },
    {
      name: "Chicken Caesar Salad (Keto)",
      description: "Grilled chicken breast over romaine lettuce with parmesan and olive oil-based Caesar dressing.",
      category: "Lunch",
      ingredients: [
        { foodName: "Chicken Breast", portionGrams: 130, unit: "g", carbs: 0, fat: 4.7, protein: 40.3, calories: 215 },
        { foodName: "Lettuce", portionGrams: 80, unit: "g", carbs: 1.9, fat: 0.2, protein: 1, calories: 14 },
        { foodName: "Parmesan", portionGrams: 20, unit: "g", carbs: 0.6, fat: 5.8, protein: 7.6, calories: 86 },
        { foodName: "Olive Oil", portionGrams: 15, unit: "g", carbs: 0, fat: 15, protein: 0, calories: 133 },
      ],
    },
    {
      name: "Keto Beef Tacos (Lettuce)",
      description: "Seasoned ground beef served in crunchy lettuce shells with cheddar and avocado.",
      category: "Dinner",
      ingredients: [
        { foodName: "Ground Beef", portionGrams: 150, unit: "g", carbs: 0, fat: 30, protein: 39, calories: 431 },
        { foodName: "Lettuce", portionGrams: 60, unit: "g", carbs: 1.4, fat: 0.2, protein: 0.7, calories: 10 },
        { foodName: "Cheddar Cheese", portionGrams: 30, unit: "g", carbs: 0.4, fat: 9.9, protein: 7.5, calories: 121 },
        { foodName: "Avocado", portionGrams: 60, unit: "g", carbs: 1.2, fat: 9, protein: 1.2, calories: 96 },
      ],
    },
    {
      name: "Turkey Meatballs in Cream Sauce",
      description: "Tender turkey meatballs simmered in a rich parmesan cream sauce.",
      category: "Dinner",
      ingredients: [
        { foodName: "Turkey Breast", portionGrams: 150, unit: "g", carbs: 0, fat: 1.5, protein: 43.5, calories: 203 },
        { foodName: "Heavy Cream", portionGrams: 60, unit: "g", carbs: 2, fat: 21, protein: 1.3, calories: 204 },
        { foodName: "Parmesan", portionGrams: 20, unit: "g", carbs: 0.6, fat: 5.8, protein: 7.6, calories: 86 },
        { foodName: "Butter", portionGrams: 10, unit: "g", carbs: 0, fat: 8.1, protein: 0.1, calories: 72 },
      ],
    },
  ];

  const seededRecipes: { id: number; category: string }[] = [];
  for (const recipe of recipesData) {
    const [created] = await db.insert(recipesTable).values({
      doctorId,
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
    }).returning();

    for (const ing of recipe.ingredients) {
      await db.insert(recipeIngredientsTable).values({
        recipeId: created.id,
        ...ing,
      });
    }
    seededRecipes.push({ id: created.id, category: recipe.category });
  }
  console.log(`Recipes seeded: ${recipesData.length} total`);

  // ── 7. Seed meal_type_recipes join table ──────────────────────────────────
  // Map recipe categories to appropriate meal type names
  const mealTypesByName = new Map(allMealTypes.map((mt) => [mt.name.toLowerCase(), mt.id]));

  const categoryToMealTypes: Record<string, string[]> = {
    "breakfast": ["Breakfast"],
    "lunch":     ["Lunch"],
    "dinner":    ["Dinner"],
    "main course": ["Lunch", "Dinner"],
    "snack":     ["Breakfast", "Lunch"],
    "soup":      ["Lunch", "Dinner"],
    "side":      ["Lunch", "Dinner"],
    "dessert":   ["Dinner"],
  };

  let mealTypeRecipeLinks = 0;
  for (const recipe of seededRecipes) {
    const categoryKey = recipe.category.toLowerCase();
    const mealTypeNames = categoryToMealTypes[categoryKey] ?? ["Lunch", "Dinner"];
    for (const typeName of mealTypeNames) {
      const mealTypeId = mealTypesByName.get(typeName.toLowerCase());
      if (mealTypeId) {
        await db.insert(mealTypeRecipesTable).values({
          mealTypeId,
          recipeId: recipe.id,
        }).onConflictDoNothing();
        mealTypeRecipeLinks++;
      }
    }
  }
  console.log(`Meal type–recipe links seeded: ${mealTypeRecipeLinks} total`);

  // ── 8. Seed predefined keto side effects ─────────────────────────────────
  const predefinedSideEffects = [
    "Constipation",
    "Vomiting",
    "Nausea",
    "Lethargy / Fatigue",
    "Kidney Stones",
    "High Cholesterol",
    "Metabolic Acidosis",
    "Growth Slowing",
    "Hypoglycemia (Low Blood Sugar)",
    "Dehydration",
    "Electrolyte Imbalance",
    "Selenium Deficiency",
    "Carnitine Deficiency",
    "Bone Health Concerns",
    "Elevated Liver Enzymes",
    "Reflux / GERD",
    "Irritability / Mood Changes",
    "Increased Bruising",
    "Poor Appetite",
    "Hair Loss",
  ];
  for (const name of predefinedSideEffects) {
    await db.insert(sideEffectsTable).values({ name, isSeeded: true }).onConflictDoUpdate({
      target: sideEffectsTable.name,
      set: { isSeeded: true },
    });
  }
  console.log(`Side effects seeded: ${predefinedSideEffects.length} entries`);

  console.log("Seeding complete!");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
