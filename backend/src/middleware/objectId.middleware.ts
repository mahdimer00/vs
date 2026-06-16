import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

/**
 * Validates that req.params.id is a well-formed MongoDB ObjectId.
 * Returns 400 before the route handler runs, preventing CastError
 * info leaks and malformed-id probing.
 */
export function validateObjectId(req: Request, res: Response, next: NextFunction) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (id && !Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  next();
}
