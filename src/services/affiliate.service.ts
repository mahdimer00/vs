import { apiRequest } from "@/services/apiClient";
import type { Affiliate, Commission, Order, PromoCode, WithdrawalRequest } from "@/types";

export const affiliateService = {
  trackClick(referralCode: string) {
    return apiRequest<{ success: boolean }>("/api/affiliate/track-click/" + referralCode, {
      method: "POST",
    });
  },
  getDashboard(token: string) {
    return apiRequest<{
      affiliate: Affiliate;
      ordersCount: number;
      clicksCount: number;
      referralLink: string;
      promoCodes: PromoCode[];
    }>("/api/affiliate/dashboard", { token });
  },
  getOrders(token: string) {
    return apiRequest<Order[]>("/api/affiliate/orders", { token });
  },
  getCommissions(token: string) {
    return apiRequest<Commission[]>("/api/affiliate/commissions", { token });
  },
  getReferralLink(token: string) {
    return apiRequest<{ referralLink: string; promoCodes: PromoCode[] }>("/api/affiliate/referral-link", { token });
  },
  requestWithdrawal(token: string, payload: { amount: number; method: string; accountInfo: string }) {
    return apiRequest<{ success: boolean }>("/api/affiliate/withdrawals", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  getWithdrawals(token: string) {
    return apiRequest<WithdrawalRequest[]>("/api/affiliate/withdrawals", { token });
  },
};
