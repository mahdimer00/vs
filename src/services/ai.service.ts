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
  generateDescription(token: string, payload: { name: string; category?: string; condition?: string; specs?: Record<string, string> }) {
    return apiRequest<{ ar: string; fr: string; en: string } | { error: string }>("/api/ai/generate-description", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
};
