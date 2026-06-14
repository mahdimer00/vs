export const ADMIN_PERMISSIONS = [
  "dashboard",
  "products",
  "categories",
  "brands",
  "orders",
  "shipping",
  "promo-codes",
  "affiliates",
  "commissions",
  "withdrawals",
  "coupon-requests",
  "settings",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
