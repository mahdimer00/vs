import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AdminPermission } from "../constants/permissions.js";

export interface AuthPayload {
  sub: string;
  role: "SUPER_ADMIN" | "ADMIN" | "ORDER_MANAGER" | "AFFILIATE" | "SUB_ADMIN";
  email: string;
  permissions?: AdminPermission[];
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(authorization.slice(7), env.JWT_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
