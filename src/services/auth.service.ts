import { apiRequest } from "@/services/apiClient";
import type { Affiliate, AuthSession } from "@/types";

export const authService = {
  adminLogin(payload: { email: string; password: string }) {
    return apiRequest<AuthSession>("/api/auth/admin/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  affiliateRegister(payload: { name: string; email: string; password: string; phone: string; ref?: string; shareMethod?: string }) {
    return apiRequest<{ message: string; email: string }>("/api/auth/affiliate/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  affiliateVerifyOtp(payload: { email: string; code: string }) {
    return apiRequest<{ token: string; affiliate: Affiliate }>("/api/auth/affiliate/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  affiliateLogin(payload: { email: string; password: string }) {
    return apiRequest<{ token: string; affiliate: Affiliate }>("/api/auth/affiliate/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  affiliateForgotPassword(email: string) {
    return apiRequest<{ message: string }>("/api/auth/affiliate/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  affiliateResetPassword(payload: { email: string; code: string; newPassword: string }) {
    return apiRequest<{ message: string }>("/api/auth/affiliate/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  me(token: string) {
    return apiRequest<{ user: { id: string; name: string; email: string; role: string } }>("/api/auth/me", {
      token,
    });
  },
};
