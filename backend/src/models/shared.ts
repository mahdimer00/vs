import { Schema } from "mongoose";

export const localizedTextSchema = new Schema(
  {
    ar: { type: String, required: true },
    fr: { type: String, required: true },
    en: { type: String, required: true },
  },
  { _id: false },
);
