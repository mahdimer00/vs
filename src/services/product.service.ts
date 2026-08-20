import { apiRequest } from "@/services/apiClient";
import type { Product } from "@/types";

let _productsCache: { data: Product[]; at: number } | null = null;
const PRODUCTS_CACHE_TTL = 5 * 60 * 1000;

export type PcRequestPayload = {
  name?: string;
  phone?: string;
  wilaya?: string;
  brand?: string;
  cpu?: string;
  ram?: string;
  screen?: string;
  storage?: string;
  budget?: string;
  usage?: string;
  battery?: string;
  notes?: string;
};

export const productService = {
  getProducts() {
    if (_productsCache && Date.now() - _productsCache.at < PRODUCTS_CACHE_TTL) {
      return Promise.resolve(_productsCache.data);
    }
    return apiRequest<Product[]>("/api/products").then((data) => {
      _productsCache = { data, at: Date.now() };
      return data;
    });
  },
  invalidateProductsCache() {
    _productsCache = null;
  },
  getProduct(slug: string) {
    return apiRequest<Product>(`/api/products/${slug}`);
  },
  requestPc(payload: PcRequestPayload) {
    return apiRequest<{ success: boolean }>("/api/request-pc", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
