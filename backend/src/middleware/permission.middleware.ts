import { NextFunction, Response } from "express";
import type { AdminPermission } from "../constants/permissions.js";
import type { AuthedRequest } from "./auth.middleware.js";

export function permissionMiddleware(...permissions: AdminPermission[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
      return next();
    }

    if (user.role === "ORDER_MANAGER" && (permissions.includes("dashboard") || permissions.includes("orders"))) {
      return next();
    }

    if (user.role === "SUB_ADMIN" && permissions.some((permission) => user.permissions?.includes(permission))) {
      return next();
    }

    return res.status(403).json({ message: "Forbidden" });
  };
}
