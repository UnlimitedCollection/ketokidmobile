import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

declare module "express-session" {
  interface SessionData {
    doctorId?: number;
    doctorName?: string;
    doctorRole?: string;
  }
}

const isProduction = process.env.NODE_ENV === "production";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && isProduction) {
  throw new Error("SESSION_SECRET environment variable is required in production but was not set.");
}

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (!isProduction) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: sessionSecret ?? "dev-only-insecure-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    },
  })
);

app.use("/api", router);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled error");
  const status = (err as { status?: number }).status ?? 500;
  const message = status < 500 ? err.message : "Internal server error";
  res.status(status).json({ error: "SERVER_ERROR", message });
});

export default app;
