export type Locale = "ar" | "fr" | "en";

export interface LocalizedText {
  ar: string;
  fr: string;
  en: string;
}

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "ORDER_MANAGER" | "SUB_ADMIN" | "AFFILIATE";

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
export type DeliveryType = "HOME_DELIVERY" | "DESK_PICKUP";
export type OrderStatus =
  | "PENDING_AI_CONFIRMATION"
  | "AWAITING_CALL_CONFIRMATION"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED"
  | "RETURNED"
  | "FAILED";

export interface Category {
  _id: string;
  name: LocalizedText;
  slug: string;
  image?: string;
  isActive: boolean;
}

export interface Brand {
  _id: string;
  name: string;
  logo?: string;
  isActive: boolean;
}

export interface ProductVariant {
  _id: string;
  sku: string;
  ram?: string;
  storage?: string;
  color?: string;
  price: number;
  stock: number;
  images: string[];
}

export interface Product {
  _id: string;
  name: LocalizedText;
  description: LocalizedText;
  slug: string;
  category: Category | string;
  brand: Brand | string;
  images: string[];
  basePrice: number;
  discountPrice?: number | null;
  variants: ProductVariant[];
  specifications?: Record<string, string>;
  stock: number;
  condition: "NEW" | "USED";
  adminNote?: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  isFeatured: boolean;
  isSoldOut?: boolean;
  localPickupOnly?: boolean;
  affiliateEnabled: boolean;
  isEuropean?: boolean;
  commissionType: "PERCENTAGE" | "FIXED";
  commissionValue: number;
  createdAt: string;
}

export interface Wilaya {
  _id: string;
  code: string;
  name: LocalizedText;
  communes: string[];
  homeDeliveryFee: number;
  deskPickupFee: number;
  isActive: boolean;
}

export interface PromoCode {
  _id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value: number;
  affiliate?: string | Affiliate | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  minimumOrderAmount?: number | null;
  productRestrictions: string[];
  categoryRestrictions: string[];
  oneUsePerPhone: boolean;
  isActive: boolean;
}

export type AffiliateLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export interface Affiliate {
  _id: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  commissionRate: number;
  status: "PENDING" | "ACTIVE" | "BLOCKED";
  level: AffiliateLevel;
  referredBy?: string | Affiliate | null;
  referralBonusPaid?: boolean;
  balancePending: number;
  balanceApproved: number;
  balancePaid: number;
  createdAt: string;
}

export interface WithdrawalRequest {
  _id: string;
  affiliate: string | Affiliate;
  amount: number;
  method: "RIP" | "CARDLESS_ID_PIN";
  accountInfo: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  voucherCode?: string;
  voucherPin?: string;
  voucherExpiresAt?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: LocalizedText;
  productSlug: string;
  variantId?: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: {
    fullName: string;
    phone: string;
    phone2?: string | null;
    wilaya: Wilaya | string;
    commune: string;
    address: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  deliveryType: DeliveryType;
  paymentMethod: "COD";
  promoCode?: string;
  affiliate?: string | Affiliate | null;
  status: OrderStatus;
  aiConfirmed: boolean;
  stockReserved?: boolean;
  zrParcelId?: string | null;
  zrTrackingNumber?: string | null;
  zrTerritoryId?: string | null;
  adminNote?: string | null;
  createdAt: string;
  confirmationToken?: string;
}

export interface Commission {
  _id: string;
  affiliate: Affiliate | string;
  order?: Order | string | null;
  type?: "SALE" | "REFERRAL_BONUS";
  sourceAffiliate?: Affiliate | string | null;
  rate: number;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  approvedAt?: string | null;
  paidAt?: string | null;
}

export interface CouponRequest {
  _id: string;
  affiliate: Affiliate | string;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value: number;
  desiredCode?: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote?: string;
  promoCode?: PromoCode | string | null;
  createdAt: string;
}

export interface AdminNotifications {
  pendingAffiliates: number;
  pendingWithdrawals: number;
  pendingCouponRequests: number;
}

export type AffiliateLevelSettings = Record<AffiliateLevel, { commissionRate: number; referralBonus: number }>;

export interface WebsiteSetting {
  _id?: string;
  storeName: string;
  logo?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  mapUrl?: string;
  socialLinks: Record<string, string>;
  defaultLanguage: Locale;
  currency: string;
  aiEnabled: boolean;
  maintenanceMode: boolean;
  promoCodeEnabled: boolean;
  directOrderMode?: boolean;
  whatsappFloat?: boolean;
  otpEnabled?: boolean;
  otpWhatsappEnabled?: boolean;
  otpEmailEnabled?: boolean;
  couponCampaignEnabled?: boolean;
  couponDiscountType?: "PERCENTAGE" | "FIXED";
  couponDiscountValue?: number;
  couponExpiryDays?: number;
  couponMinOrder?: number;
  couponConditionText?: string;
  couponSocialLinks?: Record<string, string>;
  affiliateLevels?: AffiliateLevelSettings;
}

export interface Banner {
  _id: string;
  title: LocalizedText;
  image: string;
  link?: string;
  priority: number;
  isActive: boolean;
  createdAt?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: AdminPermission[];
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface SubAdmin {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: AdminPermission[];
  isActive: boolean;
  createdAt?: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  awaitingCallOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  revenue: number;
  todayOrders: number;
  todayRevenue: number;
  weekOrders: number;
  weekRevenue: number;
  abandonedOrders: number;
  abandonedOrderDetails: Array<{ _id: string; orderNumber: string; customerName: string; phone: string; total: number; hoursAgo: number }>;
  topProducts: Array<Product & { orderCount: number }>;
  affiliateSales: Array<{ affiliate: string; total: number }>;
  promoUsage: Array<{ code: string; count: number }>;
  lowStockProducts: Product[];
  outOfStockProducts: number;
}

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface PendingOrderPayload {
  orderId: string;
  orderNumber: string;
  confirmationToken: string;
}

export type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "order_submit"
  | "purchase";

export interface AnalyticsProductEntry {
  productId: string;
  productName: LocalizedText;
  count: number;
  revenue?: number;
}

export interface AnalyticsSummary {
  totalVisitors: number;
  todayVisitors: number;
  productViews: number;
  ordersCount: number;
  conversionRate: number;
  mostViewedProducts: AnalyticsProductEntry[];
  bestSellingProducts: AnalyticsProductEntry[];
  revenueTotal: number;
  revenueToday: number;
  ordersByStatus: Record<string, number>;
  visitorsByDay: Array<{ date: string; count: number }>;
  salesByDay: Array<{ date: string; revenue: number; orders: number }>;
  // New professional analytics
  lastHourVisitors: number;
  lastHourOrders: number;
  avgOrderValue: number;
  funnel: Array<{ step: string; count: number }>;
  ordersByHour: number[];
  revenueByWilaya: Array<{ name: string; revenue: number; orders: number }>;
  conversionByProduct: Array<{ productId: string; productName: LocalizedText; views: number; orders: number; conversionRate: number }>;
}
