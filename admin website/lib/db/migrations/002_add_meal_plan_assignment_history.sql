CREATE TABLE IF NOT EXISTS "meal_plan_assignment_history" (
  "id" serial PRIMARY KEY,
  "kid_id" integer NOT NULL REFERENCES "kids"("id") ON DELETE CASCADE,
  "plan_id" integer,
  "plan_name" varchar(200),
  "doctor_id" integer REFERENCES "doctors"("id"),
  "doctor_name" varchar(200) NOT NULL,
  "action" varchar(20) NOT NULL,
  "assigned_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
