import { apiRequest } from "@/services/apiClient";
import type { DeliveryType, Order } from "@/types";

export const orderService = {
  createOrder(payload: {
    customer: {
      fullName: string;
      phone: string;
      wilayaCode: string;
      commune: string;
      address: string;
    };
    items: Array<{ productId: string; variantId: string; quantity: number }>;
    deliveryType: DeliveryType;
    promoCode?: string;
    affiliateRef?: string;
  }) {
    return apiRequest<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  startAiConfirmation(orderId: string) {
    return apiRequest<{ message: string }>("/api/orders/" + orderId + "/ai-confirm", {
      method: "POST",
    });
  },
  confirmOrder(orderId: string) {
    return apiRequest<Order>(`/api/orders/${orderId}/confirm`, {
      method: "POST",
    });
  },
  trackOrder(orderNumber: string) {
    return apiRequest<Order>(`/api/orders/track/${orderNumber}`);
  },
  trackOrdersByPhone(phone: string) {
    return apiRequest<Order[]>(`/api/orders/track-by-phone/${phone}`);
  },
};
