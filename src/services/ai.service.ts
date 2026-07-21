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
  suggestPrice(token: string, payload: { name: string; category?: string; condition?: string; specs?: Record<string, string> }) {
    return apiRequest<{ suggested: number; min: number; max: number; note_ar: string } | { error: string }>("/api/ai/suggest-price", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  dashboardInsights(token: string, payload: { todayOrders: number; weekOrders: number; revenue: number; deliveredOrders: number; pendingOrders: number; lowStockCount: number; topProducts?: Array<{ name: string; sold: number }> }) {
    return apiRequest<{ insight: string } | { error: string }>("/api/ai/dashboard-insights", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  bulkDescribe(token: string, payload: { productIds: string[] }) {
    return apiRequest<{ results: Array<{ id: string; name: string; ok: boolean }> }>("/api/ai/bulk-describe", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
};
