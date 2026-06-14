import { apiRequest, apiUpload } from "@/services/apiClient";
import type { AdminNotifications, AdminPermission, Affiliate, Banner, Brand, Category, Commission, CouponRequest, DashboardStats, Order, Product, PromoCode, SubAdmin, WebsiteSetting, Wilaya, WithdrawalRequest } from "@/types";

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
  deleteOrder(token: string, orderId: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/orders/${orderId}`, { method: "DELETE", token });
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
  getWithdrawals(token: string) {
    return apiRequest<WithdrawalRequest[]>("/api/admin/withdrawals", { token });
  },
  updateWithdrawal(token: string, id: string, status: WithdrawalRequest["status"], voucher?: { voucherCode: string; voucherPin: string }) {
    return apiRequest<WithdrawalRequest>(`/api/admin/withdrawals/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status, ...voucher }),
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
  getNotifications(token: string) {
    return apiRequest<AdminNotifications>("/api/admin/notifications", { token });
  },
  getCouponRequests(token: string) {
    return apiRequest<CouponRequest[]>("/api/admin/coupon-requests", { token });
  },
  updateCouponRequest(token: string, id: string, payload: { status: CouponRequest["status"]; adminNote?: string; code?: string }) {
    return apiRequest<CouponRequest>(`/api/admin/coupon-requests/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  getAdmins(token: string) {
    return apiRequest<SubAdmin[]>("/api/admin/admins", { token });
  },
  createAdmin(token: string, payload: { name: string; email: string; password: string; permissions: AdminPermission[] }) {
    return apiRequest<SubAdmin>("/api/admin/admins", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  updateAdmin(token: string, id: string, payload: { name?: string; password?: string; permissions?: AdminPermission[]; isActive?: boolean }) {
    return apiRequest<SubAdmin>(`/api/admin/admins/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
  deleteAdmin(token: string, id: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/admins/${id}`, { method: "DELETE", token });
  },
};
