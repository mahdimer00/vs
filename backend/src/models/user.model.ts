import { model, Schema } from "mongoose";
import { ADMIN_PERMISSIONS } from "../constants/permissions.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "SUB_ADMIN"],
      required: true,
    },
    permissions: {
      type: [{ type: String, enum: ADMIN_PERMISSIONS }],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const UserModel = model("User", userSchema);
