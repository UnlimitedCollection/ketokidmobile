import { type Request, type Response, type NextFunction } from "express";

export function restrictWriteForModerator(req: Request, res: Response, next: NextFunction): void {
  if (req.session.doctorRole === "moderator" && req.method !== "GET") {
    res.status(403).json({ error: "FORBIDDEN", message: "Read-only access: moderators cannot perform write operations" });
    return;
  }
  next();
}
