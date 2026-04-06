import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import analyticsRouter from "./analytics";
import kidsRouter from "./kids";
import foodsRouter from "./foods";
import mealPlansRouter from "./meal-plans";
import storageRouter from "./storage";
import tokensRouter from "./tokens";
import recipesRouter from "./recipes";
import mealTypesRouter from "./meal-types";
import sideEffectsRouter from "./side-effects";
import usersRouter from "./users";
import parentRouter from "./parent";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { restrictWriteForModerator } from "../middleware/restrictWriteForModerator";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/parent", parentRouter);
router.use("/auth", authRouter);

router.use(requireAuth);
router.use(restrictWriteForModerator);

router.use("/dashboard", dashboardRouter);
router.use("/analytics", analyticsRouter);
router.use("/kids", kidsRouter);
router.use("/foods", foodsRouter);
router.use("/meal-plans", mealPlansRouter);
router.use("/tokens", tokensRouter);
router.use("/recipes", recipesRouter);
router.use("/meal-types", mealTypesRouter);
router.use("/side-effects", sideEffectsRouter);
router.use(storageRouter);

router.use("/users", requireAdmin, usersRouter);

export default router;
