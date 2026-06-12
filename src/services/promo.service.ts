import { apiRequest } from "@/services/apiClient";

export const promoService = {
  validate(payload: {
    code: string;
    phone: string;
    subtotal: number;
    productIds: string[];
    categoryIds: string[];
    shippingFee: number;
  }) {
    return apiRequest<{
      valid: boolean;
      discount: number;
      affiliateId?: string;
      promo?: { code: string };
      finalTotal: number;
    }>("/api/promo/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
