import { type Request, type Response, type NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.doctorRole !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
    return;
  }
  next();
}
