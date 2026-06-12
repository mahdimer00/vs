import { NextFunction, Response } from "express";
import type { AuthedRequest } from "./auth.middleware.js";
import type { AuthPayload } from "./auth.middleware.js";

export function roleMiddleware(roles: AuthPayload["role"][]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
