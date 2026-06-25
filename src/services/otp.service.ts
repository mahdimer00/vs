import { apiRequest } from "@/services/apiClient";

export const otpService = {
  getChannels() {
    return apiRequest<{ whatsapp: boolean; email: boolean }>("/api/otp/channels");
  },
  sendOtp(phone: string, channel: "whatsapp" | "email", email?: string) {
    return apiRequest<{ success: boolean; expiresIn: number; channel: string }>("/api/otp/send", {
      method: "POST",
      body: JSON.stringify({ phone, channel, email }),
    });
  },
  verifyOtp(phone: string, code: string, channel: "whatsapp" | "email" = "whatsapp") {
    return apiRequest<{ success: boolean; verificationToken: string }>("/api/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, channel }),
    });
  },
};
