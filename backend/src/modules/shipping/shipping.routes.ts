import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { permissionMiddleware } from "../../middleware/permission.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { WilayaModel } from "../../models/shipping.model.js";
import { resolveShippingFee } from "../../utils/order.js";

const router = Router();

router.get("/shipping/wilayas", asyncHandler(async (_req, res) => res.json(await WilayaModel.find({ isActive: true }).sort({ code: 1 }).lean())));

router.post("/shipping/calculate", asyncHandler(async (req, res) => {
  const input = z.object({
    wilayaCode: z.string(),
    deliveryType: z.enum(["HOME_DELIVERY", "DESK_PICKUP"]),
    zrTerritoryId: z.string().uuid().optional(),
  }).parse(req.body);
  const { fee } = await resolveShippingFee(input.wilayaCode, input.deliveryType, input.zrTerritoryId);
  return res.json({ fee });
}));

router.patch("/admin/shipping/:wilayaId", authMiddleware, permissionMiddleware("shipping"), asyncHandler(async (req, res) => {
  const input = z.object({ homeDeliveryFee: z.number().optional(), deskPickupFee: z.number().optional(), isActive: z.boolean().optional() }).parse(req.body);
  const wilaya = await WilayaModel.findByIdAndUpdate(req.params.wilayaId, input, { new: true });
  if (!wilaya) {
    return res.status(404).json({ message: "Wilaya not found" });
  }
  return res.json(wilaya);
}));

export default router;
