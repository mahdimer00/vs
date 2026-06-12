import { apiRequest } from "@/services/apiClient";
import type { Banner } from "@/types";

export const bannerService = {
  getBanners() {
    return apiRequest<Banner[]>("/api/banners");
  },
};
