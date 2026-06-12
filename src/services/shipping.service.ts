import { apiRequest } from "@/services/apiClient";
import type { DeliveryType, Wilaya } from "@/types";

export const shippingService = {
  getWilayas() {
    return apiRequest<Wilaya[]>("/api/shipping/wilayas");
  },
  calculateShipping(payload: { wilayaCode: string; deliveryType: DeliveryType }) {
    return apiRequest<{ fee: number }>("/api/shipping/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
