import { model, Schema } from "mongoose";

const phoneBlacklistSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: "" },
    addedBy: { type: String, default: "admin" },
  },
  { timestamps: true },
);

export const PhoneBlacklistModel = model("PhoneBlacklist", phoneBlacklistSchema);
