import { model, Schema } from "mongoose";
import { localizedTextSchema } from "./shared.js";

const wilayaSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: localizedTextSchema, required: true },
    communes: [{ type: String }],
    homeDeliveryFee: { type: Number, required: true },
    deskPickupFee: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const WilayaModel = model("Wilaya", wilayaSchema);
