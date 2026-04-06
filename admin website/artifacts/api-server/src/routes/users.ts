import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { doctorsTable } from "@workspace/db";
import { eq, ne, or, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router: IRouter = Router();

const CreateUserBody = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(6),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  designation: z.string().optional(),
  profilePhoto: z.string().optional(),
  mobile: z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits").optional(),
  role: z.enum(["admin", "moderator"]),
});

const UpdateUserBody = z.object({
  username: z.string().min(3).max(100).optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  designation: z.string().optional(),
  profilePhoto: z.string().optional(),
  mobile: z.union([z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"), z.literal("")]).optional(),
  role: z.enum(["admin", "moderator"]).optional(),
});

function mapUser(u: typeof doctorsTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    designation: u.designation ?? undefined,
    profilePhoto: u.profilePhoto ?? undefined,
    mobile: u.mobile ?? undefined,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const users = await db.select().from(doctorsTable).orderBy(doctorsTable.createdAt);
    res.json(users.map(mapUser));
  } catch (err) {
    req.log.error({ err }, "List users error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    res.status(400).json({ error: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" });
    return;
  }

  const { username, password, name, email, designation, profilePhoto, mobile, role } = parsed.data;

  try {
    const existing = await db
      .select({ id: doctorsTable.id })
      .from(doctorsTable)
      .where(or(eq(doctorsTable.username, username), eq(doctorsTable.email, email)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "CONFLICT", message: "Username or email already taken" });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const [created] = await db
      .insert(doctorsTable)
      .values({ username, password: hashed, name, email, designation: designation ?? null, profilePhoto: profilePhoto ?? null, mobile: mobile ?? null, role, mustChangePassword: true })
      .returning();

    res.status(201).json(mapUser(created));
  } catch (err) {
    const dbErr = err as { code?: string };
    if (dbErr?.code === "23505") {
      res.status(409).json({ error: "CONFLICT", message: "Username or email already taken" });
      return;
    }
    req.log.error({ err }, "Create user error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.put("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid user ID" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    res.status(400).json({ error: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" });
    return;
  }

  const { username, password, name, email, designation, profilePhoto, mobile, role } = parsed.data;

  try {
    const [target] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, userId)).limit(1);
    if (!target) {
      res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
      return;
    }

    if (role === "moderator" && target.role === "admin") {
      const admins = await db
        .select({ id: doctorsTable.id })
        .from(doctorsTable)
        .where(and(eq(doctorsTable.role, "admin"), ne(doctorsTable.id, userId)));
      if (admins.length === 0) {
        res.status(400).json({ error: "BAD_REQUEST", message: "Cannot demote the last admin account" });
        return;
      }
    }

    if (username || email) {
      const conflict = await db
        .select({ id: doctorsTable.id })
        .from(doctorsTable)
        .where(
          and(
            ne(doctorsTable.id, userId),
            or(
              username ? eq(doctorsTable.username, username) : undefined,
              email ? eq(doctorsTable.email, email) : undefined
            )
          )
        )
        .limit(1);

      if (conflict.length > 0) {
        res.status(409).json({ error: "CONFLICT", message: "Username or email already taken" });
        return;
      }
    }

    const updates: Partial<typeof doctorsTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (username !== undefined) updates.username = username;
    if (designation !== undefined) updates.designation = designation || null;
    if (profilePhoto !== undefined) updates.profilePhoto = profilePhoto || null;
    if (mobile !== undefined) updates.mobile = mobile || null;
    if (role !== undefined) updates.role = role;
    if (password !== undefined) updates.password = await bcrypt.hash(password, 12);

    const [updated] = await db
      .update(doctorsTable)
      .set(updates)
      .where(eq(doctorsTable.id, userId))
      .returning();

    res.json(mapUser(updated));
  } catch (err) {
    const dbErr = err as { code?: string };
    if (dbErr?.code === "23505") {
      res.status(409).json({ error: "CONFLICT", message: "Username or email already taken" });
      return;
    }
    req.log.error({ err }, "Update user error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

router.delete("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const requestingId = req.session.doctorId!;

  if (isNaN(userId)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid user ID" });
    return;
  }

  if (userId === requestingId) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Cannot delete your own account" });
    return;
  }

  try {
    const [target] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, userId)).limit(1);
    if (!target) {
      res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
      return;
    }

    if (target.role === "admin") {
      const admins = await db
        .select({ id: doctorsTable.id })
        .from(doctorsTable)
        .where(and(eq(doctorsTable.role, "admin"), ne(doctorsTable.id, userId)));
      if (admins.length === 0) {
        res.status(400).json({ error: "BAD_REQUEST", message: "Cannot delete the last admin account" });
        return;
      }
    }

    await db.delete(doctorsTable).where(eq(doctorsTable.id, userId));
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete user error");
    res.status(500).json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
});

export default router;
