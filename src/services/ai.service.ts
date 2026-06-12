import { apiRequest } from "@/services/apiClient";

export const aiService = {
  askProductQuestion(payload: { productId: string; message: string; language: string }) {
    return apiRequest<{ message: string }>("/api/ai/product-question", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  continueOrderConfirmation(payload: { orderId: string; message: string; language: string }) {
    return apiRequest<{ message: string; confirmed: boolean }>("/api/ai/order-confirmation", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
