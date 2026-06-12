import { apiRequest } from "@/services/apiClient";
import type { Product } from "@/types";

export const productService = {
  getProducts() {
    return apiRequest<Product[]>("/api/products");
  },
  getProduct(slug: string) {
    return apiRequest<Product>(`/api/products/${slug}`);
  },
};
