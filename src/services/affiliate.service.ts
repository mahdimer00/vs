import { apiRequest } from "@/services/apiClient";
import type { Affiliate, AffiliateRecentVisitor, Commission, CouponRequest, Order, PromoCode, WithdrawalRequest } from "@/types";

export const affiliateService = {
  trackClick(referralCode: string, payload?: { visitorId?: string; landingPath?: string; referrer?: string; shortCode?: string }) {
    return apiRequest<{ success: boolean }>("/api/affiliate/track-click/" + referralCode, {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    });
  },
  getDashboard(token: string) {
    return apiRequest<{
      affiliate: Affiliate;
      ordersCount: number;
      clicksCount: number;
      visitorsCount: number;
      teamCount: number;
      referralBonusAmount: number;
      referralLink: string;
      shortReferralLink: string;
      inviteLink: string;
      shortInviteLink: string;
      promoCodes: PromoCode[];
      recentVisitors: AffiliateRecentVisitor[];
    }>("/api/affiliate/dashboard", { token });
  },
  getOrders(token: string) {
    return apiRequest<Order[]>("/api/affiliate/orders", { token });
  },
  getCommissions(token: string) {
    return apiRequest<Commission[]>("/api/affiliate/commissions", { token });
  },
  getReferralLink(token: string) {
    return apiRequest<{ referralLink: string; shortReferralLink: string; shortInviteLink: string; promoCodes: PromoCode[] }>("/api/affiliate/referral-link", { token });
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
  getTeam(token: string) {
    return apiRequest<Affiliate[]>("/api/affiliate/team", { token });
  },
  requestCoupon(token: string, payload: { type: string; value: number; desiredCode?: string; reason: string }) {
    return apiRequest<CouponRequest>("/api/affiliate/coupon-requests", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },
  getCouponRequests(token: string) {
    return apiRequest<CouponRequest[]>("/api/affiliate/coupon-requests", { token });
  },
  updateProfile(token: string, payload: { name?: string; phone?: string; currentPassword?: string; newPassword?: string }) {
    return apiRequest<Affiliate>("/api/affiliate/profile", {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
  },
};
