import { model, Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const UserModel = model("User", userSchema);
