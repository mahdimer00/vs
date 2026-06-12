import { apiRequest, apiUpload } from "@/services/apiClient";
import type { Affiliate, Banner, Brand, Category, Commission, DashboardStats, Order, Product, PromoCode, WebsiteSetting, Wilaya } from "@/types";

export const adminService = {
  getStats(token: string) {
    return apiRequest<DashboardStats>("/api/admin/stats", { token });
  },
  getOrders(token: string) {
    return apiRequest<Order[]>("/api/admin/orders", { token });
  },
  updateOrderStatus(token: string, orderId: string, status: string) {
    return apiRequest<Order>(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });
  },
  uploadImage(token: string, file: File) {
    return apiUpload<{ url: string; filename: string }>("/api/admin/uploads", file, token);
  },
  createProduct(token: string, payload: Record<string, unknown>) {
    return apiRequest<Product>("/api/admin/products", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  updateProduct(token: string, id: string, payload: Record<string, unknown>) {
    return apiRequest<Product>(`/api/admin/products/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deleteProduct(token: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/products/${id}`, { method: "DELETE", token });
  },
  getCategories() {
    return apiRequest<Category[]>("/api/categories");
  },
  createCategory(token: string, payload: Partial<Category>) {
    return apiRequest<Category>("/api/admin/categories", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  updateCategory(token: string, id: string, payload: Partial<Category>) {
    return apiRequest<Category>(`/api/admin/categories/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deleteCategory(token: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/categories/${id}`, { method: "DELETE", token });
  },
  getBrands() {
    return apiRequest<Brand[]>("/api/brands");
  },
  getBanners(token: string) {
    return apiRequest<Banner[]>("/api/admin/banners", { token });
  },
  createBanner(token: string, payload: Partial<Banner>) {
    return apiRequest<Banner>("/api/admin/banners", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  updateBanner(token: string, id: string, payload: Partial<Banner>) {
    return apiRequest<Banner>(`/api/admin/banners/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deleteBanner(token: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/banners/${id}`, { method: "DELETE", token });
  },
  createBrand(token: string, payload: Partial<Brand>) {
    return apiRequest<Brand>("/api/admin/brands", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  updateBrand(token: string, id: string, payload: Partial<Brand>) {
    return apiRequest<Brand>(`/api/admin/brands/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deleteBrand(token: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/brands/${id}`, { method: "DELETE", token });
  },
  getPromoCodes(token: string) {
    return apiRequest<PromoCode[]>("/api/admin/promo-codes", { token });
  },
  createPromoCode(token: string, payload: Partial<PromoCode>) {
    return apiRequest<PromoCode>("/api/admin/promo-codes", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  updatePromoCode(token: string, id: string, payload: Partial<PromoCode>) {
    return apiRequest<PromoCode>(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deletePromoCode(token: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/promo-codes/${id}`, { method: "DELETE", token });
  },
  getAffiliates(token: string) {
    return apiRequest<Affiliate[]>("/api/admin/affiliates", { token });
  },
  updateAffiliate(token: string, id: string, payload: Partial<Affiliate>) {
    return apiRequest<Affiliate>(`/api/admin/affiliates/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  getCommissions(token: string) {
    return apiRequest<Commission[]>("/api/admin/commissions", { token });
  },
  markCommissionPaid(token: string, id: string) {
    return apiRequest<Commission>(`/api/admin/commissions/${id}/pay`, {
      method: "PATCH",
      token,
    });
  },
  getSettings(token: string) {
    return apiRequest<WebsiteSetting>("/api/admin/settings", { token });
  },
  updateSettings(token: string, payload: Partial<WebsiteSetting>) {
    return apiRequest<WebsiteSetting>("/api/admin/settings", {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  getWilayas() {
    return apiRequest<Wilaya[]>("/api/shipping/wilayas");
  },
  updateWilaya(token: string, wilayaId: string, payload: Partial<Wilaya>) {
    return apiRequest<Wilaya>(`/api/admin/shipping/${wilayaId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
};
