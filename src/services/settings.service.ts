import { apiRequest } from "@/services/apiClient";
import type { WebsiteSetting } from "@/types";

export const settingsService = {
  getSettings() {
    return apiRequest<WebsiteSetting | null>("/api/settings");
  },
};
