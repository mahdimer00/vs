import { apiRequest } from "@/services/apiClient";

export interface ZRTerritory {
  id: string;
  name: string;
  nameAr: string;
  wilayaCode: string;
  wilayaName: string;
  wilayaNameAr: string;
  homePrice: number;
  pickupPrice: number;
  hasPricing: boolean;
}

let cachedTerritories: ZRTerritory[] | null = null;

export const zrShippingService = {
  async getTerritories(): Promise<ZRTerritory[]> {
    if (cachedTerritories) return cachedTerritories;
    try {
      const data = await apiRequest<ZRTerritory[]>("/api/zr-territories");
      cachedTerritories = data;
      return data;
    } catch {
      return [];
    }
  },
  clearCache() {
    cachedTerritories = null;
  },
};
