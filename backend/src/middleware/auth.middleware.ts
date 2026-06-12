import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthPayload {
  sub: string;
  role: "SUPER_ADMIN" | "ADMIN" | "ORDER_MANAGER" | "AFFILIATE";
  email: string;
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
    req.user = jwt.verify(authorization.slice(7), env.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
