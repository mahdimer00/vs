import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error.js";

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
      .join("; ");
    return res.status(400).json({ message: message || "Validation error", issues: error.flatten() });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message });
  }

  if (error && typeof error === "object" && "code" in error && error.code === 11000) {
    const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const field = Object.keys(keyValue)[0] ?? "value";
    return res.status(409).json({ message: `An item with this ${field} already exists` });
  }

  console.error(error);
  return res.status(500).json({ message: "Unexpected server error" });
}
