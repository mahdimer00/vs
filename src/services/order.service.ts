import { apiRequest } from "@/services/apiClient";
import type { DeliveryType, Order } from "@/types";

export const orderService = {
  createOrder(payload: {
    customer: {
      fullName: string;
      phone: string;
      phone2?: string;
      wilayaCode: string;
      commune: string;
      address: string;
    };
    items: Array<{ productId: string; variantId: string; quantity: number }>;
    deliveryType: DeliveryType;
    promoCode?: string;
    affiliateRef?: string;
    // CAPI deduplication — these are forwarded server-side to Meta's Conversions API
    capiEventId?: string;
    fbp?: string;
    fbc?: string;
    clientUserAgent?: string;
    phoneVerificationToken?: string;
    zrTerritoryId?: string;
  }) {
    return apiRequest<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  startAiConfirmation(orderId: string, confirmationToken: string) {
    return apiRequest<{ message: string }>("/api/orders/" + orderId + "/ai-confirm", {
      method: "POST",
      body: JSON.stringify({ confirmationToken }),
    });
  },
  confirmOrder(orderId: string, confirmationToken: string) {
    return apiRequest<Order>(`/api/orders/${orderId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ confirmationToken }),
    });
  },
  trackOrdersByPhone(phone: string) {
    return apiRequest<Order[]>(`/api/orders/track-by-phone/${phone}`);
  },
  getZRTracking(orderNumber: string) {
    return apiRequest<{ tracking: Array<{ state: string; stateAr: string; date: string }>; trackingNumber: string | null }>(
      `/api/orders/${orderNumber}/zr-tracking`,
    );
  },
};
