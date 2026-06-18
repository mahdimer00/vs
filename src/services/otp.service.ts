import { apiRequest } from "@/services/apiClient";

export const otpService = {
  getChannels() {
    return apiRequest<{ whatsapp: boolean }>("/api/otp/channels");
  },
  sendOtp(phone: string, channel: "whatsapp") {
    return apiRequest<{ success: boolean; expiresIn: number }>("/api/otp/send", {
      method: "POST",
      body: JSON.stringify({ phone, channel }),
    });
  },
  verifyOtp(phone: string, code: string) {
    return apiRequest<{ success: boolean; verificationToken: string }>("/api/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });
  },
};
