import {
  AlertTriangle,
  Award,
  BellRing,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Crown,
  Download,
  Facebook,
  Gift,
  Instagram,
  Link2,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  Package,
  PackageX,
  Phone,
  Printer,
  Shield,
  Sparkles,
  Store,
  Tag,
  TicketPercent,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
  Youtube,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { IconField } from "@/components/IconField";
import { ImageUploadField } from "@/components/ImageUploadField";
import { TikTokIcon } from "@/components/TikTokIcon";
import { LoadingState } from "@/components/LoadingState";
import { Seo } from "@/components/Seo";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/hooks/useApp";
import { DashboardShell } from "@/layout/DashboardShell";
import { ApiError, sseUrl } from "@/services/apiClient";
import { adminService } from "@/services/admin.service";
import { orderService } from "@/services/order.service";
import { productService } from "@/services/product.service";
import type {
  AdminNotifications,
  AdminPermission,
  Affiliate,
  AffiliateLevel,
  Banner,
  Brand,
  Category,
  Commission,
  CouponRequest,
  AnalyticsSummary,
  DashboardStats,
  Order,
  Product,
  PromoCode,
  SubAdmin,
  WebsiteSetting,
  Wilaya,
  WithdrawalRequest,
} from "@/types";
import { ADMIN_PERMISSIONS } from "@/types";
import { formatCurrency, formatDate, getLocalizedText } from "@/utils/format";
import { translate, type TranslationKey } from "@/utils/i18n";

const ZR_STATE_AR: Record<string, string> = {
  "order received": "تم استلام الطلب",
  "order in process": "الطلب قيد المعالجة",
  "confirmation call": "مكالمة تأكيد العميل",
  "order confirmed": "تم تأكيد الطلب",
  "ready to ship": "جاهز للشحن",
  "confirmed at office": "مؤكد في المكتب",
  "dispatch in the same wilaya": "إرسال داخل نفس الولاية",
  "to region": "في الطريق إلى الولاية",
  "in transit": "في الطريق",
  "out for delivery": "في رحلة التسليم",
  "out for delivery again": "محاولة تسليم ثانية",
  "delivered": "تم التسليم",
  "collected": "تم الاستلام من المكتب",
  "recovered": "مُرجَع",
  "picked up": "تم الاستلام",
  "returned": "مُرجَع",
  "failed delivery": "فشل التسليم",
  "cancelled": "ملغى",
  "accepted": "مقبول",
  "pris en charge": "تم الاستلام من المتجر",
  "en cours de livraison": "في الطريق للتسليم",
  "livré": "تم التسليم",
  "retour": "مُرجَع",
  "annulé": "ملغى",
};
const getZRStateAr = (state: string, stateAr: string) => stateAr || ZR_STATE_AR[state.toLowerCase()] || state;

const levelIcons: Record<AffiliateLevel, typeof Medal> = {
  BRONZE: Medal,
  SILVER: Award,
  GOLD: Crown,
  PLATINUM: Sparkles,
};

const affiliateLevelOrder: AffiliateLevel[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
const orderStatusOptions: Order["status"][] = [
  "PENDING_AI_CONFIRMATION",
  "AWAITING_CALL_CONFIRMATION",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "PICKED_UP",
  "CANCELLED",
  "RETURNED",
  "FAILED",
];

const orderStatusPriority = new Map<Order["status"], number>([
  ["AWAITING_CALL_CONFIRMATION", 0],
  ["PENDING_AI_CONFIRMATION", 1],
  ["CONFIRMED", 2],
  ["PROCESSING", 3],
  ["SHIPPED", 4],
  ["DELIVERED", 5],
  ["PICKED_UP", 6],
  ["FAILED", 7],
  ["RETURNED", 8],
  ["CANCELLED", 9],
]);

type ProductFormState = {
  nameAr: string;
  nameFr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEn: string;
  slug: string;
  categoryId: string;
  brandId: string;
  images: string[];
  basePrice: string;
  discountPrice: string;
  stock: string;
  condition: "NEW" | "USED";
  adminNote: string;
  isSoldOut: boolean;
  localPickupOnly: boolean;
  affiliateEnabled: boolean;
  commissionType: "PERCENTAGE" | "FIXED";
  commissionValue: string;
  specifications: { key: string; value: string }[];
};

const defaultProductForm: ProductFormState = {
  nameAr: "",
  nameFr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionFr: "",
  descriptionEn: "",
  slug: "",
  categoryId: "",
  brandId: "",
  images: [""],
  basePrice: "",
  discountPrice: "",
  stock: "1",
  condition: "NEW",
  adminNote: "",
  isSoldOut: false,
  localPickupOnly: false,
  affiliateEnabled: false,
  commissionType: "PERCENTAGE",
  commissionValue: "",
  specifications: [{ key: "", value: "" }],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type VariantDraft = {
  ram: string;
  storage: string;
  color: string;
  price: string;
  stock: string;
};

const defaultVariantDraft: VariantDraft = {
  ram: "",
  storage: "",
  color: "",
  price: "",
  stock: "",
};

type BannerFormState = {
  titleAr: string;
  titleFr: string;
  titleEn: string;
  image: string;
  link: string;
  priority: string;
  isActive: boolean;
};

const defaultBannerForm: BannerFormState = {
  titleAr: "",
  titleFr: "",
  titleEn: "",
  image: "",
  link: "",
  priority: "1",
  isActive: true,
};

type SubAdminFormState = {
  name: string;
  email: string;
  password: string;
  permissions: AdminPermission[];
};

const defaultSubAdminForm: SubAdminFormState = {
  name: "",
  email: "",
  password: "",
  permissions: [],
};

const permissionLinkMap: Record<AdminPermission, { href: string; labelKey: TranslationKey }> = {
  dashboard: { href: "/gestion", labelKey: "dashboard" },
  products: { href: "/gestion/products", labelKey: "products" },
  categories: { href: "/gestion/categories", labelKey: "categories" },
  brands: { href: "/gestion/brands", labelKey: "brands" },
  orders: { href: "/gestion/orders", labelKey: "orders" },
  shipping: { href: "/gestion/shipping", labelKey: "shippingFees" },
  "promo-codes": { href: "/gestion/promo-codes", labelKey: "promoCodes" },
  affiliates: { href: "/gestion/affiliates", labelKey: "affiliates" },
  commissions: { href: "/gestion/commissions", labelKey: "commissions" },
  withdrawals: { href: "/gestion/withdrawals", labelKey: "adminWithdrawalsTitle" },
  "coupon-requests": { href: "/gestion/coupon-requests", labelKey: "adminCouponRequestsTitle" },
  settings: { href: "/gestion/settings", labelKey: "settings" },
};

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function AdminDashboardPage() {
  const location = useLocation();
  const tab = location.pathname.replace("/gestion", "").replace(/^\//, "") || "dashboard";
  const { adminSession, setAdminSession, language, pushToast, refreshSiteSettings } = useApp();
  const token = adminSession?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [settings, setSettings] = useState<WebsiteSetting | null>(null);
  const [couponRequests, setCouponRequests] = useState<CouponRequest[]>([]);
  const [notifications, setNotifications] = useState<AdminNotifications | null>(null);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<string>("7d");
  const [analyticsFrom, setAnalyticsFrom] = useState("");
  const [analyticsTo, setAnalyticsTo] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [zrStatus, setZrStatus] = useState<{ configured: boolean; webhookUrl: string; webhooks: Array<{ id: string; url: string }> } | null>(null);
  const [zrWebhookRegistering, setZrWebhookRegistering] = useState(false);
  const [zrHistory, setZrHistory] = useState<Record<string, Array<{ state: string; stateAr: string; date: string }>>>({});
  const [zrHistoryLoading, setZrHistoryLoading] = useState<string | null>(null);
  const [zrSyncingId, setZrSyncingId] = useState<string | null>(null);
  const [telegramLabelId, setTelegramLabelId] = useState<string | null>(null);
  const [zrStateChangingId, setZrStateChangingId] = useState<string | null>(null);
  const [zrCancellingId, setZrCancellingId] = useState<string | null>(null);
  const [orderNoteEditing, setOrderNoteEditing] = useState<string | null>(null);
  const [orderNoteDraft, setOrderNoteDraft] = useState("");
  const [printLabelId, setPrintLabelId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkLabelPrinting, setBulkLabelPrinting] = useState(false);
  const [bulkReadyToShipping, setBulkReadyToShipping] = useState(false);
  const [customers, setCustomers] = useState<Array<{ _id: string; phone: string; fullName: string; orderCount: number; totalSpent: number; lastOrderDate: string; statuses: string[] }>>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: "danger" | "warning" | "info";
    onConfirm: () => void;
  } | null>(null);
  const [showAddProductForm, setShowAddProductForm] = useState(false);

  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductForm);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([{ ...defaultVariantDraft }]);
  const [categoryForm, setCategoryForm] = useState({ ar: "", fr: "", en: "", slug: "", image: "" });
  const [brandForm, setBrandForm] = useState({ name: "", logo: "" });
  const [bannerForm, setBannerForm] = useState<BannerFormState>(defaultBannerForm);
  const [promoForm, setPromoForm] = useState({ code: "", type: "FIXED", value: "1000", minimumOrderAmount: "0", usageLimit: "", expiresAt: "", affiliate: "" });
  const [shippingDrafts, setShippingDrafts] = useState<Record<string, { homeDeliveryFee: string; deskPickupFee: string }>>({});
  const [affiliateDrafts, setAffiliateDrafts] = useState<Record<string, { status: Affiliate["status"]; commissionRate: string; level: AffiliateLevel }>>({});
  const [couponDrafts, setCouponDrafts] = useState<Record<string, { code: string; adminNote: string }>>({});
  const [levelDrafts, setLevelDrafts] = useState<Record<AffiliateLevel, { commissionRate: string; referralBonus: string }> | null>(null);
  const [bannerDrafts, setBannerDrafts] = useState<Record<string, BannerFormState>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, { ar: string; fr: string; en: string; slug: string; image: string; isActive: boolean }>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [brandDrafts, setBrandDrafts] = useState<Record<string, { name: string; logo: string; isActive: boolean }>>({});
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [promoDrafts, setPromoDrafts] = useState<Record<string, { type: string; value: string; usageLimit: string; expiresAt: string; isActive: boolean; affiliate: string }>>({});
  const [voucherDrafts, setVoucherDrafts] = useState<Record<string, { code: string; pin: string }>>({});
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [orderFilters, setOrderFilters] = useState({
    status: "all",
    wilaya: "all",
    date: "",
    phone: "",
    orderNumber: "",
  });
  const [orderActionId, setOrderActionId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [subAdminForm, setSubAdminForm] = useState<SubAdminFormState>(defaultSubAdminForm);
  const [subAdminDrafts, setSubAdminDrafts] = useState<Record<string, { permissions: AdminPermission[]; password: string }>>({});
  const [showManualOrderForm, setShowManualOrderForm] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState({
    fullName: "",
    phone: "",
    phone2: "",
    wilayaCode: "",
    commune: "",
    address: "",
    deliveryType: "HOME_DELIVERY" as "HOME_DELIVERY" | "DESK_PICKUP",
    promoCode: "",
    items: [{ productId: "", variantId: "", quantity: "1" }],
  });
  const [manualOrderSaving, setManualOrderSaving] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");
  const [promoStatusFilter, setPromoStatusFilter] = useState("all");
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [affiliateStatusFilter, setAffiliateStatusFilter] = useState("all");
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("all");
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("all");
  const [couponStatusFilter, setCouponStatusFilter] = useState("PENDING");
  const [subAdminSearch, setSubAdminSearch] = useState("");

  const role = adminSession?.user.role;
  const userPermissions = adminSession?.user.permissions;
  const isSubAdmin = role === "SUB_ADMIN";

  const badges: Partial<Record<AdminPermission, number | undefined>> = {
    affiliates: notifications?.pendingAffiliates,
    withdrawals: notifications?.pendingWithdrawals,
    "coupon-requests": notifications?.pendingCouponRequests,
  };

  const links = ADMIN_PERMISSIONS.filter((permission) => !isSubAdmin || userPermissions?.includes(permission)).map((permission) => {
    const { href, labelKey } = permissionLinkMap[permission];
    return { href, label: translate(language, labelKey), badge: badges[permission] };
  });

  if (role === "SUPER_ADMIN") {
    links.push({ href: "/gestion/admins", label: translate(language, "adminAdminsTitle"), badge: undefined });
  }
  // Analytics is available to anyone with the dashboard permission
  if (!isSubAdmin || userPermissions?.includes("dashboard")) {
    links.push({ href: "/gestion/analytics", label: translate(language, "analyticsTitle"), badge: undefined });
  }
  // Customers tab — available to anyone with orders permission
  if (!isSubAdmin || userPermissions?.includes("orders")) {
    links.push({ href: "/gestion/customers", label: "العملاء", badge: undefined });
  }

  const loadAnalytics = async (period: string, from?: string, to?: string) => {
    setAnalyticsLoading(true);
    try {
      const data = await adminService.getAnalytics(token, period, from, to);
      setAnalyticsData(data);
    } catch {
      // silently fail — analytics tab shows empty state
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const safe = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
        promise.catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 403) {
            return fallback;
          }
          throw error;
        });

      const [
        statsData,
        productData,
        categoryData,
        brandData,
        bannerData,
        orderData,
        wilayaData,
        promoData,
        affiliateData,
        commissionData,
        settingsData,
        withdrawalData,
        couponRequestData,
        notificationData,
        subAdminData,
      ] = await Promise.all([
        safe(adminService.getStats(token), null),
        productService.getProducts(),
        adminService.getCategories(),
        adminService.getBrands(),
        safe(adminService.getBanners(token), []),
        safe(adminService.getOrders(token, 0, 100), { orders: [], total: 0 } as { orders: Order[]; total: number }),
        adminService.getWilayas(),
        safe(adminService.getPromoCodes(token), []),
        safe(adminService.getAffiliates(token), []),
        safe(adminService.getCommissions(token), []),
        safe(adminService.getSettings(token), null),
        safe(adminService.getWithdrawals(token), []),
        safe(adminService.getCouponRequests(token), []),
        safe(adminService.getNotifications(token), null),
        role === "SUPER_ADMIN" ? safe(adminService.getAdmins(token), []) : Promise.resolve([]),
      ]);

      setStats(statsData);
      setProducts(productData);
      setCategories(categoryData);
      setBrands(brandData);
      setBanners(bannerData);
      const orderResult = orderData as { orders: Order[]; total: number };
      setOrders(orderResult.orders ?? []);
      setOrdersTotal(orderResult.total ?? 0);
      setWilayas(wilayaData);
      setPromos(promoData);
      setAffiliates(affiliateData);
      setCommissions(commissionData);
      setSettings(settingsData);
      setWithdrawals(withdrawalData);
      setCouponRequests(couponRequestData);
      setNotifications(notificationData);
      setSubAdmins(subAdminData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void loadAll();
    }
  }, [token]);

  // Real-time order status updates via Server-Sent Events
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(sseUrl("/api/admin/events", token));
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type: string; orderId: string; status: string };
        if (payload.type === "order:status") {
          setOrders((prev) =>
            prev.map((o) => (o._id === payload.orderId ? { ...o, status: payload.status as import("@/types").OrderStatus } : o)),
          );
        }
      } catch { /* ignore malformed events */ }
    };
    return () => es.close();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load analytics data when navigating to analytics tab
  useEffect(() => {
    if (token && tab === "analytics") {
      void loadAnalytics(analyticsPeriod, analyticsFrom || undefined, analyticsTo || undefined);
    }
  }, [tab, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load ZR status when navigating to orders tab
  useEffect(() => {
    if (token && tab === "orders") {
      adminService.getZRStatus(token)
        .then(setZrStatus)
        .catch(() => setZrStatus({ configured: false, webhookUrl: "", webhooks: [] }));
    }
  }, [tab, token]); // eslint-disable-line react-hooks/exhaustive-deps


  // Load customers when navigating to customers tab
  useEffect(() => {
    if (token && tab === "customers" && customers.length === 0) {
      adminService.getCustomers(token)
        .then(setCustomers)
        .catch(() => setCustomers([]));
    }
  }, [tab, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setShippingDrafts(
      Object.fromEntries(
        wilayas.map((wilaya) => [
          wilaya._id,
          {
            homeDeliveryFee: String(wilaya.homeDeliveryFee),
            deskPickupFee: String(wilaya.deskPickupFee),
          },
        ]),
      ),
    );
  }, [wilayas]);

  useEffect(() => {
    setAffiliateDrafts(
      Object.fromEntries(
        affiliates.map((affiliate) => [
          affiliate._id,
          {
            status: affiliate.status,
            commissionRate: String(affiliate.commissionRate),
            level: affiliate.level || "BRONZE",
          },
        ]),
      ),
    );
  }, [affiliates]);

  useEffect(() => {
    setSubAdminDrafts(
      Object.fromEntries(
        subAdmins.map((subAdmin) => [
          subAdmin._id,
          {
            permissions: subAdmin.permissions,
            password: "",
          },
        ]),
      ),
    );
  }, [subAdmins]);

  useEffect(() => {
    setCouponDrafts(
      Object.fromEntries(
        couponRequests.map((request) => [
          request._id,
          {
            code: request.desiredCode || "",
            adminNote: request.adminNote || "",
          },
        ]),
      ),
    );
  }, [couponRequests]);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setLevelDrafts(
      Object.fromEntries(
        affiliateLevelOrder.map((level) => [
          level,
          {
            commissionRate: String(settings.affiliateLevels?.[level]?.commissionRate ?? 0),
            referralBonus: String(settings.affiliateLevels?.[level]?.referralBonus ?? 0),
          },
        ]),
      ) as Record<AffiliateLevel, { commissionRate: string; referralBonus: string }>,
    );
  }, [settings]);

  useEffect(() => {
    setBannerDrafts(
      Object.fromEntries(
        banners.map((banner) => [
          banner._id,
          {
            titleAr: banner.title.ar,
            titleFr: banner.title.fr,
            titleEn: banner.title.en,
            image: banner.image,
            link: banner.link || "",
            priority: String(banner.priority),
            isActive: banner.isActive,
          },
        ]),
      ),
    );
  }, [banners]);

  useEffect(() => {
    setCategoryDrafts(
      Object.fromEntries(
        categories.map((category) => [
          category._id,
          {
            ar: category.name.ar,
            fr: category.name.fr,
            en: category.name.en,
            slug: category.slug,
            image: category.image || "",
            isActive: category.isActive,
          },
        ]),
      ),
    );
  }, [categories]);

  useEffect(() => {
    setBrandDrafts(
      Object.fromEntries(
        brands.map((brand) => [
          brand._id,
          {
            name: brand.name,
            logo: brand.logo || "",
            isActive: brand.isActive,
          },
        ]),
      ),
    );
  }, [brands]);

  useEffect(() => {
    setPromoDrafts(
      Object.fromEntries(
        promos.map((promo) => [
          promo._id,
          {
            type: promo.type,
            value: String(promo.value),
            usageLimit: promo.usageLimit ? String(promo.usageLimit) : "",
            expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : "",
            isActive: promo.isActive,
            affiliate: typeof promo.affiliate === "string" ? promo.affiliate : promo.affiliate?._id || "",
          },
        ]),
      ),
    );
  }, [promos]);

  const ordersById = useMemo(() => new Map(orders.map((order) => [order._id, order])), [orders]);
  const orderSummaryCards = useMemo(
    () => [
      {
        key: "all",
        label: translate(language, "orders"),
        count: orders.length,
        icon: BarChart3,
        tone: "bg-slate-950 text-white",
      },
      {
        key: "AWAITING_CALL_CONFIRMATION",
        label: translate(language, "status_AWAITING_CALL_CONFIRMATION"),
        count: orders.filter((order) => order.status === "AWAITING_CALL_CONFIRMATION" || order.status === "PENDING_AI_CONFIRMATION").length,
        icon: Phone,
        tone: "bg-amber-100 text-amber-700",
      },
      {
        key: "CONFIRMED",
        label: translate(language, "status_CONFIRMED"),
        count: orders.filter((order) => order.status === "CONFIRMED").length,
        icon: Check,
        tone: "bg-emerald-100 text-emerald-700",
      },
      {
        key: "PROCESSING",
        label: translate(language, "status_PROCESSING"),
        count: orders.filter((order) => order.status === "PROCESSING").length,
        icon: Store,
        tone: "bg-sky-100 text-sky-700",
      },
      {
        key: "SHIPPED",
        label: translate(language, "status_SHIPPED"),
        count: orders.filter((order) => order.status === "SHIPPED").length,
        icon: Truck,
        tone: "bg-violet-100 text-violet-700",
      },
      {
        key: "DELIVERED",
        label: translate(language, "status_DELIVERED"),
        count: orders.filter((order) => order.status === "DELIVERED" || order.status === "PICKED_UP").length,
        icon: Shield,
        tone: "bg-emerald-100 text-emerald-700",
      },
    ],
    [language, orders],
  );
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
      const wilayaLabel =
        typeof order.customer.wilaya === "string"
          ? order.customer.wilaya
          : language === "ar"
            ? order.customer.wilaya.name.ar
            : language === "fr"
              ? order.customer.wilaya.name.fr
              : order.customer.wilaya.name.en;

      return (
        (orderFilters.status === "all" ||
          (orderFilters.status === "AWAITING_CALL_CONFIRMATION"
            ? order.status === "AWAITING_CALL_CONFIRMATION" || order.status === "PENDING_AI_CONFIRMATION"
            : order.status === orderFilters.status)) &&
        (orderFilters.wilaya === "all" || wilayaLabel === orderFilters.wilaya) &&
        (!orderFilters.phone || order.customer.phone.includes(orderFilters.phone)) &&
        (!orderFilters.date || order.createdAt.slice(0, 10) >= orderFilters.date) &&
        (!orderFilters.orderNumber || order.orderNumber.toLowerCase().includes(orderFilters.orderNumber.toLowerCase()))
      );
      })
      .sort((left, right) => {
        const leftPriority = orderStatusPriority.get(left.status) ?? 99;
        const rightPriority = orderStatusPriority.get(right.status) ?? 99;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [language, orderFilters, orders]);

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (errorMessage) {
    return (
      <DashboardShell
        title={translate(language, "dashboard")}
        description={translate(language, "authAdminDescription")}
        links={links}
        onLogout={() => setAdminSession(null)}
      >
        <EmptyState
          title={translate(language, "adminDataLoadErrorTitle")}
          description={errorMessage}
          action={
            <button onClick={() => void loadAll()} className="primary-button">
              {translate(language, "adminRetry")}
            </button>
          }
        />
      </DashboardShell>
    );
  }

  const startEditProduct = (product: Product) => {
    setEditingProductId(product._id);
    setProductForm({
      nameAr: product.name.ar,
      nameFr: product.name.fr,
      nameEn: product.name.en,
      descriptionAr: product.description.ar,
      descriptionFr: product.description.fr,
      descriptionEn: product.description.en,
      slug: product.slug,
      categoryId: typeof product.category === "string" ? product.category : product.category._id,
      brandId: typeof product.brand === "string" ? product.brand : product.brand._id,
      images: product.images.length > 0 ? product.images : [""],
      basePrice: String(product.basePrice),
      discountPrice: product.discountPrice ? String(product.discountPrice) : "",
      stock: String(product.stock),
      condition: product.condition || "NEW",
      adminNote: product.adminNote || "",
      isSoldOut: product.isSoldOut ?? false,
      localPickupOnly: product.localPickupOnly ?? false,
      affiliateEnabled: product.affiliateEnabled,
      commissionType: product.commissionType,
      commissionValue: product.commissionValue ? String(product.commissionValue) : "",
      specifications: Object.entries(product.specifications ?? {}).length > 0
        ? Object.entries(product.specifications ?? {}).map(([key, value]) => ({ key, value }))
        : [{ key: "", value: "" }],
    });
    setVariantDrafts(
      product.variants.length > 0
        ? product.variants.map((variant) => ({
            ram: variant.ram || "",
            storage: variant.storage || "",
            color: variant.color || "",
            price: String(variant.price),
            stock: String(variant.stock),
          }))
        : [{ ...defaultVariantDraft }],
    );
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setProductForm(defaultProductForm);
    setVariantDrafts([{ ...defaultVariantDraft }]);
    setShowAddProductForm(false);
  };

  const submitProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const images = productForm.images.map((image) => image.trim()).filter(Boolean);
    if (images.length === 0) {
      pushToast(translate(language, "adminActionError"), "error");
      return;
    }

    const slug = productForm.slug.trim() || slugify(productForm.nameEn || productForm.nameFr || productForm.nameAr);
    const filledDrafts = variantDrafts.filter((draft) => draft.ram || draft.storage || draft.color || draft.price || draft.stock);
    const variantSource = filledDrafts.length > 0 ? filledDrafts : [defaultVariantDraft];
    const basePayload = {
      name: { ar: productForm.nameAr, fr: productForm.nameFr, en: productForm.nameEn },
      description: { ar: productForm.descriptionAr, fr: productForm.descriptionFr, en: productForm.descriptionEn },
      slug,
      category: productForm.categoryId,
      brand: productForm.brandId,
      images,
      basePrice: Number(productForm.basePrice),
      discountPrice: productForm.discountPrice ? Number(productForm.discountPrice) : undefined,
      specifications: Object.fromEntries(
        productForm.specifications
          .map((spec) => ({ key: spec.key.trim(), value: spec.value.trim() }))
          .filter((spec) => spec.key && spec.value)
          .map((spec) => [spec.key, spec.value]),
      ),
      stock: Number(productForm.stock),
      condition: productForm.condition,
      adminNote: productForm.adminNote.trim() || undefined,
      status: "ACTIVE",
      isFeatured: false,
      isSoldOut: productForm.isSoldOut,
      localPickupOnly: productForm.localPickupOnly,
      affiliateEnabled: productForm.affiliateEnabled,
      commissionType: productForm.commissionType,
      commissionValue: Number(productForm.commissionValue || 0),
      variants: variantSource.map((draft, index) => ({
        sku: `${slug}-${String(index + 1).padStart(3, "0")}`,
        ram: draft.ram || undefined,
        storage: draft.storage || undefined,
        color: draft.color || undefined,
        price: Number(draft.price || productForm.basePrice),
        stock: Number(draft.stock || productForm.stock),
        images,
      })),
    };

    try {
      if (editingProductId) {
        await adminService.updateProduct(token, editingProductId, basePayload);
        cancelEditProduct();
      } else {
        await adminService.createProduct(token, basePayload);
        setProductForm(defaultProductForm);
        setVariantDrafts([{ ...defaultVariantDraft }]);
        setShowAddProductForm(false);
      }
      await loadAll();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    }
  };

  const updateProductImage = (index: number, url: string) => {
    setProductForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) => (imageIndex === index ? url : image)),
    }));
  };

  const addProductImage = () => {
    setProductForm((current) => ({ ...current, images: [...current.images, ""] }));
  };

  const removeProductImage = (index: number) => {
    setProductForm((current) => ({
      ...current,
      images: current.images.length > 1 ? current.images.filter((_, imageIndex) => imageIndex !== index) : current.images,
    }));
  };

  const updateProductSpec = (index: number, patch: Partial<{ key: string; value: string }>) => {
    setProductForm((current) => ({
      ...current,
      specifications: current.specifications.map((spec, specIndex) => (specIndex === index ? { ...spec, ...patch } : spec)),
    }));
  };

  const addProductSpec = () => {
    setProductForm((current) => ({ ...current, specifications: [...current.specifications, { key: "", value: "" }] }));
  };

  const removeProductSpec = (index: number) => {
    setProductForm((current) => ({
      ...current,
      specifications: current.specifications.length > 1 ? current.specifications.filter((_, specIndex) => specIndex !== index) : current.specifications,
    }));
  };

  const updateVariantDraft = (index: number, patch: Partial<VariantDraft>) => {
    setVariantDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)));
  };

  const renderAnalytics = () => {
    const periods = [
      { value: "today", label: translate(language, "analyticsToday") },
      { value: "7d", label: translate(language, "analytics7d") },
      { value: "30d", label: translate(language, "analytics30d") },
      { value: "custom", label: translate(language, "analyticsCustom") },
    ] as const;

    const handlePeriodChange = (value: string) => {
      setAnalyticsPeriod(value);
      if (value !== "custom") {
        void loadAnalytics(value);
      }
    };

    const handleCustomApply = () => {
      if (analyticsFrom && analyticsTo) {
        void loadAnalytics("custom", analyticsFrom, analyticsTo);
      }
    };

    const data = analyticsData;

    // Simple SVG bar chart
    const BarChart = ({
      bars,
      color,
      formatTip,
    }: {
      bars: Array<{ label: string; value: number }>;
      color: string;
      formatTip: (v: number) => string;
    }) => {
      const max = Math.max(...bars.map((b) => b.value), 1);
      return (
        <div className="flex h-40 items-end gap-1">
          {bars.map((bar) => {
            const height = Math.max(4, Math.round((bar.value / max) * 100));
            return (
              <div key={bar.label} className="group relative flex flex-1 flex-col items-center gap-1" title={`${bar.label}: ${formatTip(bar.value)}`}>
                <div
                  className={`w-full rounded-t-md transition-all ${color}`}
                  style={{ height: `${height}%` }}
                />
                <span className="truncate text-center text-[10px] text-slate-400">
                  {bar.label.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      );
    };

    const statusColors: Record<string, string> = {
      PENDING_AI_CONFIRMATION: "bg-slate-400",
      AWAITING_CALL_CONFIRMATION: "bg-amber-400",
      CONFIRMED: "bg-sky-400",
      PROCESSING: "bg-blue-400",
      SHIPPED: "bg-violet-400",
      DELIVERED: "bg-emerald-500",
      PICKED_UP: "bg-teal-500",
      CANCELLED: "bg-rose-500",
      RETURNED: "bg-orange-500",
      FAILED: "bg-red-400",
    };

    return (
      <div className="space-y-6">
        {/* Period filter */}
        <Panel title={translate(language, "analyticsTitle")}>
          <div className="flex flex-wrap items-center gap-3">
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePeriodChange(p.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  analyticsPeriod === p.value
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {analyticsPeriod === "custom" && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">{translate(language, "analyticsFrom")}</label>
                <input
                  type="date"
                  value={analyticsFrom}
                  onChange={(e) => setAnalyticsFrom(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">{translate(language, "analyticsTo")}</label>
                <input
                  type="date"
                  value={analyticsTo}
                  onChange={(e) => setAnalyticsTo(e.target.value)}
                  className="field-input"
                />
              </div>
              <button
                type="button"
                onClick={handleCustomApply}
                disabled={!analyticsFrom || !analyticsTo}
                className="primary-button"
              >
                {translate(language, "analyticsCustom")}
              </button>
            </div>
          )}
          {data ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  const rows = [
                    ["Metric", "Value"],
                    ["Visitors", String(data.totalVisitors)],
                    ["Today Visitors", String(data.todayVisitors)],
                    ["Product Views", String(data.productViews)],
                    ["Total Orders", String(data.ordersCount)],
                    ["Revenue (DZD)", String(data.revenueTotal)],
                    ["Conversion Rate", String(data.conversionRate)],
                  ];
                  const csv = rows.map((r) => r.join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `analytics-${analyticsPeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="ghost-button gap-2"
              >
                <Download className="h-4 w-4" />
                تصدير CSV
              </button>
            </div>
          ) : null}
        </Panel>

        {analyticsLoading ? (
          <div className="flex justify-center py-16">
            <div className="text-sm text-slate-500">{translate(language, "analyticsLoading")}</div>
          </div>
        ) : !data ? (
          <EmptyState title={translate(language, "analyticsNoData")} description="" />
        ) : (
          <>
            {/* KPI stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { icon: Users, label: translate(language, "analyticsVisitors"), value: data.totalVisitors.toLocaleString() },
                { icon: TrendingUp, label: translate(language, "analyticsTodayVisitors"), value: data.todayVisitors.toLocaleString() },
                { icon: BarChart3, label: translate(language, "analyticsProductViews"), value: data.productViews.toLocaleString() },
                { icon: BarChart3, label: translate(language, "analyticsOrders"), value: data.ordersCount.toLocaleString() },
                { icon: TrendingUp, label: translate(language, "analyticsConversionRate"), value: `${data.conversionRate}%` },
                { icon: Wallet, label: translate(language, "analyticsRevenue"), value: formatCurrency(data.revenueTotal, language) },
                { icon: Wallet, label: translate(language, "analyticsRevenueToday"), value: formatCurrency(data.revenueToday, language) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="stat-card flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">{label}</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title={translate(language, "analyticsVisitorsByDay")}>
                {data.visitorsByDay.every((d) => d.count === 0) ? (
                  <p className="py-6 text-center text-sm text-slate-400">{translate(language, "analyticsNoData")}</p>
                ) : (
                  <BarChart
                    bars={data.visitorsByDay.map((d) => ({ label: d.date, value: d.count }))}
                    color="bg-sky-400"
                    formatTip={(v) => `${v} ${translate(language, "analyticsVisitors")}`}
                  />
                )}
              </Panel>
              <Panel title={translate(language, "analyticsSalesByDay")}>
                {data.salesByDay.every((d) => d.revenue === 0) ? (
                  <p className="py-6 text-center text-sm text-slate-400">{translate(language, "analyticsNoData")}</p>
                ) : (
                  <BarChart
                    bars={data.salesByDay.map((d) => ({ label: d.date, value: d.revenue }))}
                    color="bg-emerald-400"
                    formatTip={(v) => formatCurrency(v, language)}
                  />
                )}
              </Panel>
            </div>

            {/* Orders by status */}
            <Panel title={translate(language, "analyticsOrdersByStatus")}>
              {Object.keys(data.ordersByStatus).length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">{translate(language, "analyticsNoData")}</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(data.ordersByStatus).map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${statusColors[status] ?? "bg-slate-400"}`} />
                      <span className="font-medium text-slate-700">{status}</span>
                      <span className="font-bold text-slate-950">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Product tables */}
            <div className="grid gap-6 xl:grid-cols-2">
              {/* Most viewed products */}
              <Panel title={translate(language, "analyticsMostViewed")}>
                {data.mostViewedProducts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">{translate(language, "analyticsNoData")}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.mostViewedProducts.map((item, index) => (
                      <div key={item.productId} className="flex items-center gap-3 py-3">
                        <span className="w-6 shrink-0 text-center text-sm font-bold text-slate-400">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                          {getLocalizedText(item.productName, language)}
                        </span>
                        <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                          {item.count} {translate(language, "analyticsViews")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* Best selling products */}
              <Panel title={translate(language, "analyticsBestSelling")}>
                {data.bestSellingProducts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">{translate(language, "analyticsNoData")}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.bestSellingProducts.map((item, index) => (
                      <div key={item.productId} className="flex items-center gap-3 py-3">
                        <span className="w-6 shrink-0 text-center text-sm font-bold text-slate-400">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                          {getLocalizedText(item.productName, language)}
                        </span>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            {item.count} {translate(language, "analyticsSales")}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatCurrency(item.revenue ?? 0, language)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDashboard = () => {
    if (!stats) {
      return null;
    }

    const actionableOrders = orders.filter((order) => order.status === "PENDING_AI_CONFIRMATION" || order.status === "AWAITING_CALL_CONFIRMATION");
    const now = Date.now();
    const soon = now + 3 * 24 * 60 * 60 * 1000;
    const expiringPromos = promos.filter((promo) => promo.expiresAt && new Date(promo.expiresAt).getTime() <= soon);

    const alerts = [
      notifications && notifications.pendingAffiliates > 0
        ? {
            key: "affiliates",
            icon: Users,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            label: translate(language, "adminAlertAffiliatesPending").replace("{count}", String(notifications.pendingAffiliates)),
            href: "/gestion/affiliates",
          }
        : null,
      notifications && notifications.pendingWithdrawals > 0
        ? {
            key: "withdrawals",
            icon: Wallet,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            label: translate(language, "adminAlertWithdrawalsPending").replace("{count}", String(notifications.pendingWithdrawals)),
            href: "/gestion/withdrawals",
          }
        : null,
      notifications && notifications.pendingCouponRequests > 0
        ? {
            key: "coupons",
            icon: Gift,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            label: translate(language, "adminAlertCouponRequestsPending").replace("{count}", String(notifications.pendingCouponRequests)),
            href: "/gestion/coupon-requests",
          }
        : null,
      actionableOrders.length > 0
        ? {
            key: "orders",
            icon: BellRing,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            label: translate(language, "adminAlertOrdersPending").replace("{count}", String(actionableOrders.length)),
            href: "/gestion/orders",
          }
        : null,
      stats.lowStockProducts.length > 0
        ? {
            key: "lowstock",
            icon: PackageX,
            tone: "border-rose-200 bg-rose-50 text-rose-800",
            label: translate(language, "adminAlertLowStock").replace("{count}", String(stats.lowStockProducts.length)),
            href: "/gestion/products",
          }
        : null,
      expiringPromos.length > 0
        ? {
            key: "promos",
            icon: TicketPercent,
            tone: "border-sky-200 bg-sky-50 text-sky-800",
            label: translate(language, "adminAlertPromosExpiring").replace("{count}", String(expiringPromos.length)),
            href: "/gestion/promo-codes",
          }
        : null,
    ].filter((alert): alert is NonNullable<typeof alert> => alert !== null);

    return (
      <div className="space-y-6">
        {alerts.length > 0 ? (
          <Panel title={translate(language, "adminAlertsTitle")}>
            <div className="grid gap-3 md:grid-cols-3">
              {alerts.map((alert) => (
                <Link key={alert.key} to={alert.href} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:-translate-y-0.5 ${alert.tone}`}>
                  <alert.icon className="h-5 w-5 shrink-0" />
                  <span>{alert.label}</span>
                </Link>
              ))}
            </div>
          </Panel>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{translate(language, "adminAlertsNone")}</span>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            [translate(language, "orders"), String(stats.totalOrders)],
            [translate(language, "dashboardPending"), String(stats.pendingOrders)],
            [translate(language, "dashboardDelivered"), String(stats.deliveredOrders)],
            [translate(language, "dashboardRevenue"), formatCurrency(stats.revenue, language)],
          ].map(([label, value]) => (
            <div key={label} className="stat-card">
              <div className="text-sm text-slate-500">{label}</div>
              <div className="mt-3 break-words text-2xl font-semibold text-slate-950 sm:text-3xl">{value}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title={translate(language, "dashboardLowStock")}>
            <div className="space-y-3">
              {stats.lowStockProducts.map((product) => (
                <div key={product._id} className="muted-card flex items-center justify-between px-4 py-3 text-sm">
                  <span>{getLocalizedText(product.name, language)}</span>
                  <span className="font-semibold text-slate-900">{product.stock}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={translate(language, "dashboardTopProducts")}>
            <div className="space-y-3">
              {stats.topProducts.map((product) => (
                <div key={product._id} className="muted-card flex items-center justify-between px-4 py-3 text-sm">
                  <span>{getLocalizedText(product.name, language)}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(product.basePrice, language)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  };

  const renderProducts = () => (
    <div className="space-y-6">
      {(showAddProductForm || editingProductId) && (
      <div id="product-add-form">
      <Panel title={editingProductId ? translate(language, "adminEditingProduct") : translate(language, "adminProductCreate")} description={translate(language, "adminProductsTitle")}>
        {editingProductId ? (
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>{translate(language, "adminEditingProductHint")}</span>
            <button type="button" onClick={cancelEditProduct} className="font-semibold underline">
              {translate(language, "adminCancel")}
            </button>
          </div>
        ) : null}
        <form onSubmit={submitProduct} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={productForm.nameAr} onChange={(event) => setProductForm({ ...productForm, nameAr: event.target.value })} className="field-input" placeholder={translate(language, "adminProductNameAr")} />
          <input value={productForm.nameFr} onChange={(event) => setProductForm({ ...productForm, nameFr: event.target.value })} className="field-input" placeholder={translate(language, "adminProductNameFr")} />
          <input value={productForm.nameEn} onChange={(event) => setProductForm({ ...productForm, nameEn: event.target.value })} className="field-input" placeholder={translate(language, "adminProductNameEn")} />
          <div className="md:col-span-2 xl:col-span-1">
            <input value={productForm.slug} onChange={(event) => setProductForm({ ...productForm, slug: event.target.value })} className="field-input w-full" placeholder={translate(language, "adminSlug")} />
            <p className="mt-1 text-xs leading-5 text-slate-500">{translate(language, "adminSlugHint")}</p>
          </div>
          <select value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })} className="field-select">
            <option value="">{translate(language, "adminCategory")}</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {getLocalizedText(category.name, language)}
              </option>
            ))}
          </select>
          <select value={productForm.brandId} onChange={(event) => setProductForm({ ...productForm, brandId: event.target.value })} className="field-select">
            <option value="">{translate(language, "adminBrand")}</option>
            {brands.map((brand) => (
              <option key={brand._id} value={brand._id}>
                {brand.name}
              </option>
            ))}
          </select>

          <textarea value={productForm.descriptionAr} onChange={(event) => setProductForm({ ...productForm, descriptionAr: event.target.value })} className="field-input md:col-span-2 xl:col-span-4" rows={2} placeholder={translate(language, "adminDescriptionAr")} />
          <textarea value={productForm.descriptionFr} onChange={(event) => setProductForm({ ...productForm, descriptionFr: event.target.value })} className="field-input md:col-span-2 xl:col-span-4" rows={2} placeholder={translate(language, "adminDescriptionFr")} />
          <textarea value={productForm.descriptionEn} onChange={(event) => setProductForm({ ...productForm, descriptionEn: event.target.value })} className="field-input md:col-span-2 xl:col-span-4" rows={2} placeholder={translate(language, "adminDescriptionEn")} />

          <div className="admin-soft-card md:col-span-2 xl:col-span-4 space-y-3">
            <div className="text-sm font-semibold text-slate-700">{translate(language, "adminProductImages")}</div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {productForm.images.map((image, index) => (
                <div key={index} className="space-y-2">
                  <ImageUploadField token={token} value={image} onChange={(url) => updateProductImage(index, url)} />
                  <button
                    type="button"
                    onClick={() => removeProductImage(index)}
                    disabled={productForm.images.length <= 1}
                    className="text-sm font-semibold text-rose-600 disabled:opacity-30"
                  >
                    {translate(language, "adminRemoveImage")}
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addProductImage} className="ghost-button">
              {translate(language, "adminAddImage")}
            </button>
          </div>

          <div className="admin-soft-card md:col-span-2 xl:col-span-4 space-y-3">
            <div className="text-sm font-semibold text-slate-700">{translate(language, "adminProductSpecifications")}</div>
            <p className="text-sm text-slate-500">{translate(language, "adminProductSpecificationsHint")}</p>
            <div className="grid gap-3">
              {productForm.specifications.map((spec, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <input
                    value={spec.key}
                    onChange={(event) => updateProductSpec(index, { key: event.target.value })}
                    className="field-input"
                    placeholder={translate(language, "adminSpecificationName")}
                  />
                  <input
                    value={spec.value}
                    onChange={(event) => updateProductSpec(index, { value: event.target.value })}
                    className="field-input"
                    placeholder={translate(language, "adminSpecificationValue")}
                  />
                  <button
                    type="button"
                    onClick={() => removeProductSpec(index)}
                    disabled={productForm.specifications.length <= 1}
                    className="text-sm font-semibold text-rose-600 disabled:opacity-30"
                  >
                    {translate(language, "adminRemove")}
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addProductSpec} className="ghost-button">
              {translate(language, "adminAddSpecification")}
            </button>
          </div>

          <input value={productForm.basePrice} onChange={(event) => setProductForm({ ...productForm, basePrice: event.target.value })} className="field-input" placeholder={translate(language, "adminBasePrice")} />
          <input value={productForm.discountPrice} onChange={(event) => setProductForm({ ...productForm, discountPrice: event.target.value })} className="field-input" placeholder={translate(language, "adminDiscountPrice")} />
          <input value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} className="field-input" placeholder={translate(language, "adminTotalStock")} />
          <select value={productForm.condition} onChange={(event) => setProductForm({ ...productForm, condition: event.target.value as "NEW" | "USED" })} className="field-select">
            <option value="NEW">{translate(language, "adminConditionNew")}</option>
            <option value="USED">{translate(language, "adminConditionUsed")}</option>
          </select>

          <textarea
            value={productForm.adminNote}
            onChange={(event) => setProductForm({ ...productForm, adminNote: event.target.value })}
            className="field-input md:col-span-2 xl:col-span-4"
            rows={2}
            placeholder={translate(language, "adminNotePlaceholder")}
          />

          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.isSoldOut}
                onChange={(event) => setProductForm({ ...productForm, isSoldOut: event.target.checked })}
                className="h-4 w-4 rounded border-rose-300 accent-rose-600"
              />
              {translate(language, "productSoldOut")} — {translate(language, "adminSoldOutHint") || "يُظهر المنتج كـ Sold Out ولا يمكن الشراء منه"}
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.localPickupOnly}
                onChange={(event) => setProductForm({ ...productForm, localPickupOnly: event.target.checked })}
                className="h-4 w-4 rounded border-amber-300 accent-amber-600"
              />
              متوفر في المتجر فقط — لا يوجد توصيل لهذا المنتج
            </label>
          </div>

          <div className="admin-soft-card md:col-span-2 xl:col-span-4 space-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={productForm.affiliateEnabled}
                onChange={(event) => setProductForm({ ...productForm, affiliateEnabled: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              {translate(language, "adminAffiliateProgramLabel")}
            </label>
            {productForm.affiliateEnabled ? (
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={productForm.commissionType}
                  onChange={(event) => setProductForm({ ...productForm, commissionType: event.target.value as "PERCENTAGE" | "FIXED" })}
                  className="field-select"
                >
                  <option value="PERCENTAGE">{translate(language, "adminCommissionTypePercentage")}</option>
                  <option value="FIXED">{translate(language, "adminCommissionTypeFixed")}</option>
                </select>
                <input
                  value={productForm.commissionValue}
                  onChange={(event) => setProductForm({ ...productForm, commissionValue: event.target.value })}
                  className="field-input"
                  placeholder={translate(language, "adminCommissionValue")}
                />
              </div>
            ) : null}
          </div>

          <div className="admin-soft-card md:col-span-2 xl:col-span-4 space-y-3">
            <div className="text-sm font-semibold text-slate-700">{translate(language, "adminVariantsTitle")}</div>
            <p className="text-xs leading-6 text-slate-500">{translate(language, "adminVariantsHint")}</p>
            {variantDrafts.map((draft, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <input value={draft.ram} onChange={(event) => updateVariantDraft(index, { ram: event.target.value })} className="field-input" placeholder={translate(language, "adminRam")} />
                <input value={draft.storage} onChange={(event) => updateVariantDraft(index, { storage: event.target.value })} className="field-input" placeholder={translate(language, "adminStorage")} />
                <input value={draft.color} onChange={(event) => updateVariantDraft(index, { color: event.target.value })} className="field-input" placeholder={translate(language, "adminColor")} />
                <input value={draft.price} onChange={(event) => updateVariantDraft(index, { price: event.target.value })} className="field-input" placeholder={translate(language, "adminVariantPrice")} />
                <input value={draft.stock} onChange={(event) => updateVariantDraft(index, { stock: event.target.value })} className="field-input" placeholder={translate(language, "adminVariantStock")} />
                <button
                  type="button"
                  onClick={() => setVariantDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))}
                  disabled={variantDrafts.length <= 1}
                  className="text-sm font-semibold text-rose-600 disabled:opacity-30"
                >
                  {translate(language, "adminRemoveVariant")}
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setVariantDrafts((current) => [...current, { ...defaultVariantDraft }])} className="ghost-button">
              {translate(language, "adminAddVariant")}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 xl:col-span-4">
            <button className="primary-button">{translate(language, editingProductId ? "adminSave" : "adminCreate")}</button>
            <button type="button" onClick={cancelEditProduct} className="ghost-button">
              {translate(language, "adminClearForm")}
            </button>
          </div>
        </form>
      </Panel>
      </div>
      )}

      <div className="table-wrap">
        <table className="table-base">
          <thead>
            <tr>
              <th>{translate(language, "products")}</th>
              <th>{translate(language, "adminBrand")}</th>
              <th>{translate(language, "adminBasePrice")}</th>
              <th>{translate(language, "productStock")}</th>
              <th>Status</th>
              <th>{translate(language, "settings")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id}>
                <td>{getLocalizedText(product.name, language)}</td>
                <td>{typeof product.brand === "string" ? product.brand : product.brand.name}</td>
                <td>{formatCurrency(product.basePrice, language)}</td>
                <td>{product.stock}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                  {product.isSoldOut ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      <PackageX className="h-3.5 w-3.5" /> Sold Out
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
                  )}
                  {product.localPickupOnly ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">متجر فقط</span>
                  ) : null}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void adminService.updateProduct(token, product._id, { isSoldOut: !product.isSoldOut }).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))}
                      className={`text-xs font-semibold ${product.isSoldOut ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {product.isSoldOut ? "✓ Activate" : "✗ Sold Out"}
                    </button>
                    <button onClick={() => startEditProduct(product)} className="text-sm font-semibold text-teal-700">
                      {translate(language, "adminEdit")}
                    </button>
                    <button onClick={() => void adminService.deleteProduct(token, product._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="text-sm font-semibold text-rose-600">
                      {translate(language, "adminDelete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      <Panel title={translate(language, "adminCategoriesTitle")}>
        <div className="grid gap-4 md:grid-cols-4">
          <input value={categoryForm.ar} onChange={(event) => setCategoryForm({ ...categoryForm, ar: event.target.value })} className="field-input" placeholder={translate(language, "adminProductNameAr")} />
          <input value={categoryForm.fr} onChange={(event) => setCategoryForm({ ...categoryForm, fr: event.target.value })} className="field-input" placeholder={translate(language, "adminProductNameFr")} />
          <input value={categoryForm.en} onChange={(event) => setCategoryForm({ ...categoryForm, en: event.target.value })} className="field-input" placeholder={translate(language, "adminProductNameEn")} />
          <input value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} className="field-input" placeholder={translate(language, "adminSlug")} />
        </div>
        <div className="mt-4 max-w-sm">
          <ImageUploadField token={token} value={categoryForm.image} onChange={(url) => setCategoryForm({ ...categoryForm, image: url })} />
        </div>
        <button
          onClick={() =>
            void adminService
              .createCategory(token, {
                name: { ar: categoryForm.ar, fr: categoryForm.fr, en: categoryForm.en },
                slug: categoryForm.slug,
                image: categoryForm.image || undefined,
                isActive: true,
              })
              .then(async () => {
                setCategoryForm({ ar: "", fr: "", en: "", slug: "", image: "" });
                await loadAll();
              })
              .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
          }
          className="primary-button mt-4"
        >
          {translate(language, "adminCreate")}
        </button>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const draft = categoryDrafts[category._id];
          const isEditing = editingCategoryId === category._id;

          if (isEditing && draft) {
            return (
              <div key={category._id} className="admin-record-card space-y-3">
                <input value={draft.ar} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category._id]: { ...draft, ar: event.target.value } }))} className="field-input" placeholder={translate(language, "adminProductNameAr")} />
                <input value={draft.fr} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category._id]: { ...draft, fr: event.target.value } }))} className="field-input" placeholder={translate(language, "adminProductNameFr")} />
                <input value={draft.en} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category._id]: { ...draft, en: event.target.value } }))} className="field-input" placeholder={translate(language, "adminProductNameEn")} />
                <input value={draft.slug} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category._id]: { ...draft, slug: event.target.value } }))} className="field-input" placeholder={translate(language, "adminSlug")} />
                <ImageUploadField token={token} value={draft.image} onChange={(url) => setCategoryDrafts((current) => ({ ...current, [category._id]: { ...draft, image: url } }))} />
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      void adminService
                        .updateCategory(token, category._id, {
                          name: { ar: draft.ar, fr: draft.fr, en: draft.en },
                          slug: draft.slug,
                          image: draft.image || undefined,
                          isActive: draft.isActive,
                        })
                        .then(async () => {
                          setEditingCategoryId(null);
                          await loadAll();
                        })
                        .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                    }
                    className="primary-button"
                  >
                    {translate(language, "adminSave")}
                  </button>
                  <button type="button" onClick={() => setEditingCategoryId(null)} className="ghost-button">
                    {translate(language, "adminCancel")}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={category._id} className="admin-record-card">
              {category.image ? (
                <img src={category.image} alt="" className="mb-3 h-24 w-full rounded-[1rem] object-cover" />
              ) : null}
              <div className="text-lg font-semibold text-slate-950">{getLocalizedText(category.name, language)}</div>
              <div className="mt-1 text-sm text-slate-500">{category.slug}</div>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => setEditingCategoryId(category._id)} className="ghost-button px-4 py-2 text-xs">
                  {translate(language, "adminEdit")}
                </button>
                <button onClick={() => void adminService.deleteCategory(token, category._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="ghost-button px-4 py-2 text-xs text-rose-600">
                  {translate(language, "adminDelete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderBrands = () => (
    <div className="space-y-6">
      <Panel title={translate(language, "adminBrandsTitle")}>
        <div className="grid gap-4 md:grid-cols-2">
          <input value={brandForm.name} onChange={(event) => setBrandForm({ ...brandForm, name: event.target.value })} className="field-input" placeholder={translate(language, "adminBrand")} />
          <ImageUploadField token={token} value={brandForm.logo} onChange={(url) => setBrandForm({ ...brandForm, logo: url })} />
        </div>
        <button onClick={() => void adminService.createBrand(token, { ...brandForm, isActive: true }).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="primary-button mt-4">
          {translate(language, "adminCreate")}
        </button>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {brands.map((brand) => {
          const draft = brandDrafts[brand._id];
          const isEditing = editingBrandId === brand._id;

          if (isEditing && draft) {
            return (
              <div key={brand._id} className="admin-record-card space-y-3">
                <input value={draft.name} onChange={(event) => setBrandDrafts((current) => ({ ...current, [brand._id]: { ...draft, name: event.target.value } }))} className="field-input" placeholder={translate(language, "adminBrand")} />
                <ImageUploadField token={token} value={draft.logo} onChange={(url) => setBrandDrafts((current) => ({ ...current, [brand._id]: { ...draft, logo: url } }))} />
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      void adminService
                        .updateBrand(token, brand._id, { name: draft.name, logo: draft.logo, isActive: draft.isActive })
                        .then(async () => {
                          setEditingBrandId(null);
                          await loadAll();
                        })
                        .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                    }
                    className="primary-button"
                  >
                    {translate(language, "adminSave")}
                  </button>
                  <button type="button" onClick={() => setEditingBrandId(null)} className="ghost-button">
                    {translate(language, "adminCancel")}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={brand._id} className="admin-record-card">
              <div className="text-lg font-semibold text-slate-950">{brand.name}</div>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => setEditingBrandId(brand._id)} className="ghost-button px-4 py-2 text-xs">
                  {translate(language, "adminEdit")}
                </button>
                <button onClick={() => void adminService.deleteBrand(token, brand._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="ghost-button px-4 py-2 text-xs text-rose-600">
                  {translate(language, "adminDelete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const exportOrdersCSV = () => {
    const headers = ["Order #", "Customer", "Phone", "Wilaya", "Status", "Total (DZD)", "Date", "Items"];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      order.customer.fullName,
      order.customer.phone,
      typeof order.customer.wilaya === "string" ? order.customer.wilaya : order.customer.wilaya.name.fr,
      order.status,
      String(order.total),
      order.createdAt.slice(0, 10),
      order.items.map((item) => `${item.productName.en ?? item.productName.ar} x${item.quantity}`).join("; "),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateOrderStatusAction = async (orderId: string, status: Order["status"]) => {
    setOrderActionId(orderId);
    try {
      await adminService.updateOrderStatus(token, orderId, status);
      await loadAll();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setOrderActionId(null);
    }
  };

  const confirmUpdateStatus = (orderId: string, status: Order["status"], orderNumber: string) => {
    const statusLabel = translate(language, `status_${status}` as TranslationKey);
    setConfirmModal({
      title: language === "ar" ? "تغيير حالة الطلب" : language === "fr" ? "Changer le statut" : "Change Order Status",
      message: language === "ar"
        ? `هل تريد تغيير حالة الطلب ${orderNumber} إلى "${statusLabel}"؟`
        : language === "fr"
          ? `Changer le statut de la commande ${orderNumber} en "${statusLabel}" ?`
          : `Change order ${orderNumber} status to "${statusLabel}"?`,
      confirmLabel: language === "ar" ? "تأكيد" : language === "fr" ? "Confirmer" : "Confirm",
      tone: ["CANCELLED", "RETURNED", "FAILED"].includes(status) ? "danger" : "info",
      onConfirm: () => void updateOrderStatusAction(orderId, status),
    });
  };

  const deleteOrderAction = async (orderId: string) => {
    setOrderActionId(orderId);
    try {
      await adminService.deleteOrder(token, orderId);
      await loadAll();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setOrderActionId(null);
    }
  };

  const confirmDeleteOrder = (orderId: string, orderNumber: string) => {
    setConfirmModal({
      title: language === "ar" ? "حذف الطلب" : language === "fr" ? "Supprimer la commande" : "Delete Order",
      message: language === "ar"
        ? `هل أنت متأكد من حذف الطلب ${orderNumber}؟ لا يمكن التراجع عن هذا الإجراء.`
        : language === "fr"
          ? `Supprimer définitivement la commande ${orderNumber} ? Cette action est irréversible.`
          : `Permanently delete order ${orderNumber}? This cannot be undone.`,
      confirmLabel: language === "ar" ? "حذف" : language === "fr" ? "Supprimer" : "Delete",
      tone: "danger",
      onConfirm: () => void deleteOrderAction(orderId),
    });
  };

  const createZRParcelAction = async (orderId: string) => {
    setOrderActionId(orderId);
    try {
      const result = await adminService.createZRParcel(token, orderId);
      pushToast(`ZR parcel created: ${result.trackingNumber}`, "success");
      await loadAll();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setOrderActionId(null);
    }
  };

  const confirmCreateZRParcel = (orderId: string, orderNumber: string) => {
    setConfirmModal({
      title: language === "ar" ? "إنشاء شحنة ZR Express" : language === "fr" ? "Créer un colis ZR" : "Create ZR Express Parcel",
      message: language === "ar"
        ? `هل تريد إنشاء شحنة ZR Express للطلب ${orderNumber}؟`
        : language === "fr"
          ? `Créer un colis ZR Express pour la commande ${orderNumber} ?`
          : `Create a ZR Express parcel for order ${orderNumber}?`,
      confirmLabel: language === "ar" ? "إنشاء" : language === "fr" ? "Créer" : "Create",
      tone: "info",
      onConfirm: () => void createZRParcelAction(orderId),
    });
  };

  const syncZRStatusAction = async (orderId: string) => {
    setZrSyncingId(orderId);
    try {
      const result = await adminService.syncZRParcelStatus(token, orderId);
      pushToast(`ZR: ${result.zrState} → ${result.orderStatus}`, "success");
      await loadAll();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setZrSyncingId(null);
    }
  };

  const setZRStateAction = async (orderId: string, stateId: string, stateLabel: string) => {
    setZrStateChangingId(orderId);
    try {
      await adminService.setZRParcelState(token, orderId, stateId);
      pushToast(language === "ar" ? `تم تغيير حالة ZR إلى: ${stateLabel}` : `ZR state changed to: ${stateLabel}`, "success");
      await loadAll();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setZrStateChangingId(null);
    }
  };

  const cancelZRParcelAction = (orderId: string, orderNumber: string) => {
    setConfirmModal({
      title: language === "ar" ? "إلغاء شحنة ZR" : "Cancel ZR Parcel",
      message: language === "ar" ? `هل تريد إلغاء شحنة ZR للطلب ${orderNumber}؟` : `Cancel ZR parcel for order ${orderNumber}?`,
      confirmLabel: language === "ar" ? "إلغاء الشحنة" : "Cancel Parcel",
      tone: "danger",
      onConfirm: async () => {
        setZrCancellingId(orderId);
        try {
          await adminService.cancelZRParcel(token, orderId);
          pushToast(language === "ar" ? "تم إلغاء شحنة ZR ✓" : "ZR parcel cancelled", "success");
          await loadAll();
        } catch (error) {
          pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
        } finally {
          setZrCancellingId(null);
        }
      },
    });
  };

  const saveOrderNote = async (orderId: string, note: string) => {
    try {
      await adminService.saveOrderNote(token, orderId, note);
      pushToast(language === "ar" ? "تم حفظ الملاحظة ✓" : "Note saved", "success");
      setOrderNoteEditing(null);
      await loadAll();
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    }
  };

  const loadZRHistory = async (orderId: string) => {
    if (zrHistory[orderId]) {
      setZrHistory((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      return;
    }
    setZrHistoryLoading(orderId);
    try {
      const history = await adminService.getZRParcelHistory(token, orderId);
      setZrHistory((prev) => ({ ...prev, [orderId]: history }));
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setZrHistoryLoading(null);
    }
  };

  const printBulkLabels = async () => {
    const ids = [...selectedOrderIds];
    if (ids.length === 0) return;
    setBulkLabelPrinting(true);
    try {
      const blob = await adminService.printBulkZRLabels(token, ids);
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob as unknown as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `zr-labels-bulk.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSelectedOrderIds(new Set());
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setBulkLabelPrinting(false);
    }
  };

  const bulkReadyToShipAction = async () => {
    const ids = [...selectedOrderIds];
    if (ids.length === 0) return;
    setBulkReadyToShipping(true);
    try {
      const result = await adminService.bulkReadyToShip(token, ids);
      pushToast(
        language === "ar"
          ? `جاهز للشحن: ${result.succeeded.length} ✓، ${result.failed.length} فشل`
          : `Ready to ship: ${result.succeeded.length} ok, ${result.failed.length} failed`,
        result.failed.length === 0 ? "success" : "error",
      );
      setSelectedOrderIds(new Set());
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setBulkReadyToShipping(false);
    }
  };

  const sendLabelToTelegramAction = async (orderId: string) => {
    setTelegramLabelId(orderId);
    try {
      await adminService.sendLabelToTelegram(token, orderId);
      pushToast(language === "ar" ? "تم إرسال الوصل إلى Telegram ✓" : language === "fr" ? "Bon envoyé sur Telegram ✓" : "Waybill sent to Telegram ✓", "success");
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setTelegramLabelId(null);
    }
  };

  const printReceiptAction = (order: Order) => {
    const wilayaLabel = typeof order.customer.wilaya === "string"
      ? order.customer.wilaya
      : order.customer.wilaya.name.ar || order.customer.wilaya.name.fr || order.customer.wilaya.name.en;
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>وصل طلب ${order.orderNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 32px; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
  .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .meta { text-align: left; font-size: 12px; color: #555; }
  .meta .num { font-size: 18px; font-weight: 700; color: #111; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 8px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .info-box { background: #f8f8f8; border-radius: 8px; padding: 12px 16px; }
  .info-box p { margin-bottom: 4px; font-size: 13px; }
  .info-box strong { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: right; padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; border-bottom: 1px solid #e5e5e5; }
  td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .totals { margin-left: auto; width: 240px; }
  .totals tr td:first-child { color: #666; }
  .totals tr td:last-child { font-weight: 600; text-align: left; }
  .totals .grand td { font-size: 16px; font-weight: 800; border-top: 2px solid #111; padding-top: 10px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #166534; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #aaa; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <div class="logo">VisaDZ</div>
  <div class="meta">
    <div class="num">${order.orderNumber}</div>
    <div>${new Date(order.createdAt).toLocaleDateString("fr-DZ", { day: "2-digit", month: "long", year: "numeric" })}</div>
    ${order.zrTrackingNumber ? `<div style="margin-top:4px;font-weight:600">ZR: ${order.zrTrackingNumber}</div>` : ""}
  </div>
</div>
<div class="grid2">
  <div class="info-box">
    <div class="section-title">بيانات الزبون</div>
    <p><strong>${order.customer.fullName}</strong></p>
    <p>${order.customer.phone}${order.customer.phone2 ? ` / ${order.customer.phone2}` : ""}</p>
    <p>${wilayaLabel}${order.customer.commune ? ` — ${order.customer.commune}` : ""}</p>
    ${order.customer.address ? `<p>${order.customer.address}</p>` : ""}
  </div>
  <div class="info-box">
    <div class="section-title">بيانات التسليم</div>
    <p><strong>${order.deliveryType === "HOME_DELIVERY" ? "توصيل للمنزل" : "استلام من المكتب"}</strong></p>
    <p>طريقة الدفع: <strong>COD — الدفع عند التسليم</strong></p>
    <p>الحالة: <span class="badge">${order.status}</span></p>
  </div>
</div>
<div class="section-title">المنتجات</div>
<table>
  <thead><tr><th>المنتج</th><th>المتغير</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
  <tbody>
    ${order.items.map((item) => `<tr>
      <td>${typeof item.productName === "object" ? (item.productName.ar || item.productName.fr || item.productName.en) : item.productName}</td>
      <td style="color:#888">${item.variantLabel ?? "—"}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td>${item.unitPrice.toLocaleString("fr-DZ")} دج</td>
      <td style="font-weight:600">${item.lineTotal.toLocaleString("fr-DZ")} دج</td>
    </tr>`).join("")}
  </tbody>
</table>
<table class="totals">
  <tr><td>المبلغ الفرعي</td><td>${order.subtotal.toLocaleString("fr-DZ")} دج</td></tr>
  ${order.discount > 0 ? `<tr><td>الخصم</td><td>- ${order.discount.toLocaleString("fr-DZ")} دج</td></tr>` : ""}
  <tr><td>رسوم التوصيل</td><td>${order.shippingFee.toLocaleString("fr-DZ")} دج</td></tr>
  <tr class="grand"><td>الإجمالي</td><td>${order.total.toLocaleString("fr-DZ")} دج</td></tr>
</table>
<div class="footer">VisaDZ · visadz.store · شكراً لتسوقك معنا</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const printLabelAction = async (orderId: string, trackingNumber: string) => {
    setPrintLabelId(orderId);
    try {
      const blob = await adminService.downloadLabel(token, orderId);
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob as unknown as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `waybill-${trackingNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
    } finally {
      setPrintLabelId(null);
    }
  };

  const renderOrders = () => {
    const colOrder = language === "ar" ? "الطلب" : language === "fr" ? "Commande" : "Order";
    const colCustomer = language === "ar" ? "العميل" : language === "fr" ? "Client" : "Customer";
    const colPhone = language === "ar" ? "الهاتف" : language === "fr" ? "Téléphone" : "Phone";
    const colStatus = language === "ar" ? "الحالة" : language === "fr" ? "Statut" : "Status";
    const colTotal = language === "ar" ? "المبلغ" : language === "fr" ? "Total" : "Total";
    const colDate = language === "ar" ? "التاريخ" : language === "fr" ? "Date" : "Date";
    const emptyText = language === "ar" ? "لا توجد طلبات" : language === "fr" ? "Aucune commande" : "No orders found";

    const webhookAlreadyRegistered = zrStatus?.webhooks.some((wh) =>
      wh.url === zrStatus.webhookUrl || wh.url?.includes("/webhooks/zrexpress"),
    );

    return (
      <div className="space-y-4">
        {/* ZR Express Status Panel — always visible */}
        <div className={`rounded-2xl border px-5 py-4 ${
          zrStatus === null
            ? "border-slate-200 bg-slate-50 animate-pulse"
            : zrStatus.configured
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* ZR logo mark */}
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${
                zrStatus === null ? "bg-slate-200 text-slate-400" : zrStatus.configured ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-600"
              }`}>
                ZR
              </div>
              <div>
                <div className={`text-base font-bold ${
                  zrStatus === null ? "text-slate-400" : zrStatus.configured ? "text-emerald-800" : "text-rose-700"
                }`}>
                  {zrStatus === null
                    ? (language === "ar" ? "جارٍ التحقق من ZR Express..." : "Checking ZR Express...")
                    : zrStatus.configured
                      ? (language === "ar" ? "ZR Express — متصل ✓" : language === "fr" ? "ZR Express — Connecté ✓" : "ZR Express — Connected ✓")
                      : (language === "ar" ? "ZR Express — غير مُفعّل" : "ZR Express — Not configured")}
                </div>
                {zrStatus?.configured && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {language === "ar" ? "الـ API تعمل" : "API active"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Webhook
                    </span>
                    <span className="font-mono opacity-70">{zrStatus.webhookUrl}</span>
                  </div>
                )}
                {zrStatus && !zrStatus.configured && (
                  <div className="mt-0.5 text-xs text-rose-600">
                    {language === "ar" ? "أضف ZR_EXPRESS_TENANT_ID و ZR_EXPRESS_SECRET_KEY في ملف .env على الخادم" : "Add ZR_EXPRESS_TENANT_ID and ZR_EXPRESS_SECRET_KEY to server .env"}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Refresh status */}
              <button
                type="button"
                onClick={() => {
                  setZrStatus(null);
                  adminService.getZRStatus(token).then(setZrStatus).catch(() => setZrStatus({ configured: false, webhookUrl: "", webhooks: [] }));
                }}
                className="ghost-button gap-1.5 px-3 py-2 text-xs"
                title={language === "ar" ? "تحديث" : "Refresh"}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                {language === "ar" ? "تحديث" : "Refresh"}
              </button>
              {/* Register webhook if not found via API (may be registered via ZR panel) */}
              {zrStatus?.configured && !webhookAlreadyRegistered && (
                <button
                  type="button"
                  disabled={zrWebhookRegistering}
                  onClick={() => {
                    setZrWebhookRegistering(true);
                    adminService.registerZRWebhook(token, zrStatus.webhookUrl)
                      .then(() => {
                        pushToast(language === "ar" ? "تم تسجيل الـ Webhook بنجاح" : "Webhook registered successfully", "success");
                        return adminService.getZRStatus(token).then(setZrStatus);
                      })
                      .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : "Webhook registration failed", "error"))
                      .finally(() => setZrWebhookRegistering(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Package className="h-4 w-4" />
                  {zrWebhookRegistering
                    ? (language === "ar" ? "جارٍ..." : "Registering...")
                    : (language === "ar" ? "ربط Webhook" : language === "fr" ? "Enregistrer" : "Register Webhook")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status summary tiles */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          {orderSummaryCards.map((card) => {
            const Icon = card.icon;
            const active = orderFilters.status === card.key || (card.key === "all" && orderFilters.status === "all");
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setOrderFilters((c) => ({ ...c, status: card.key === "all" ? "all" : card.key }))}
                className={`rounded-2xl border px-3 py-2.5 text-start transition ${active ? "border-slate-950 shadow-md shadow-slate-200/50" : "border-slate-200 hover:border-slate-300"} ${card.tone}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-3.5 w-3.5 opacity-60" />
                  <span className="text-lg font-bold">{card.count}</span>
                </div>
                <div className="mt-1 truncate text-[9px] font-bold uppercase tracking-widest opacity-70">{card.label}</div>
              </button>
            );
          })}
        </div>

        {/* Manual / local order creation */}
        <div className="admin-panel px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">طلب محلي (بدون موقع)</h3>
              <p className="mt-0.5 text-xs text-slate-500">أنشئ طلباً يدوياً من رسالة أو مكالمة دون أن يمر بالموقع</p>
            </div>
            <button
              type="button"
              onClick={() => setShowManualOrderForm((v) => !v)}
              className="primary-button gap-2 shrink-0"
            >
              <Package className="h-4 w-4" />
              {showManualOrderForm ? "إخفاء النموذج" : "إنشاء طلب محلي"}
            </button>
          </div>

          {showManualOrderForm ? (
            <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
              {/* Customer info */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <input
                  value={manualOrderForm.fullName}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="field-input"
                  placeholder="اسم العميل *"
                />
                <input
                  value={manualOrderForm.phone}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, phone: e.target.value }))}
                  className="field-input"
                  placeholder="الهاتف * (05xxxxxxxx)"
                />
                <input
                  value={manualOrderForm.phone2}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, phone2: e.target.value }))}
                  className="field-input"
                  placeholder="هاتف ثانٍ (اختياري)"
                />
                <select
                  value={manualOrderForm.wilayaCode}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, wilayaCode: e.target.value, commune: "" }))}
                  className="field-select"
                >
                  <option value="">اختر الولاية *</option>
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>{w.code} - {w.name.ar}</option>
                  ))}
                </select>
                <select
                  value={manualOrderForm.commune}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, commune: e.target.value }))}
                  className="field-select"
                  disabled={!manualOrderForm.wilayaCode}
                >
                  <option value="">اختر البلدية *</option>
                  {(wilayas.find((w) => w.code === manualOrderForm.wilayaCode)?.communes || []).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  value={manualOrderForm.address}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, address: e.target.value }))}
                  className="field-input"
                  placeholder="العنوان التفصيلي"
                />
              </div>

              {/* Delivery + promo */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={manualOrderForm.deliveryType}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, deliveryType: e.target.value as "HOME_DELIVERY" | "DESK_PICKUP" }))}
                  className="field-select max-w-[180px]"
                >
                  <option value="HOME_DELIVERY">توصيل للمنزل</option>
                  <option value="DESK_PICKUP">سحب من المكتب</option>
                </select>
                <input
                  value={manualOrderForm.promoCode}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, promoCode: e.target.value.toUpperCase() }))}
                  className="field-input max-w-[180px] uppercase"
                  placeholder="كود تخفيض (اختياري)"
                />
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">المنتجات</div>
                {manualOrderForm.items.map((item, idx) => {
                  const selectedProduct = products.find((p) => p._id === item.productId);
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <select
                        value={item.productId}
                        onChange={(e) => setManualOrderForm((f) => {
                          const updated = [...f.items];
                          updated[idx] = { productId: e.target.value, variantId: "", quantity: "1" };
                          return { ...f, items: updated };
                        })}
                        className="field-select flex-1 min-w-[180px]"
                      >
                        <option value="">اختر المنتج</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>{getLocalizedText(p.name, language)}</option>
                        ))}
                      </select>
                      {selectedProduct?.variants && selectedProduct.variants.length > 0 ? (
                        <select
                          value={item.variantId}
                          onChange={(e) => setManualOrderForm((f) => {
                            const updated = [...f.items];
                            updated[idx] = { ...updated[idx], variantId: e.target.value };
                            return { ...f, items: updated };
                          })}
                          className="field-select max-w-[180px]"
                        >
                          <option value="">اختر الخيار</option>
                          {selectedProduct.variants.map((v) => (
                            <option key={v._id} value={v._id}>{v.ram} {v.storage} {v.color} - {v.price} دج</option>
                          ))}
                        </select>
                      ) : null}
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => setManualOrderForm((f) => {
                          const updated = [...f.items];
                          updated[idx] = { ...updated[idx], quantity: e.target.value };
                          return { ...f, items: updated };
                        })}
                        className="field-input w-20"
                        placeholder="الكمية"
                      />
                      {manualOrderForm.items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setManualOrderForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                          className="ghost-button px-2 py-2 text-rose-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setManualOrderForm((f) => ({ ...f, items: [...f.items, { productId: "", variantId: "", quantity: "1" }] }))}
                  className="ghost-button gap-2 text-sm"
                >
                  + إضافة منتج آخر
                </button>
              </div>

              {/* Submit */}
              <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={manualOrderSaving}
                  onClick={async () => {
                    if (!manualOrderForm.fullName || !manualOrderForm.phone || !manualOrderForm.wilayaCode || !manualOrderForm.commune) {
                      pushToast("يرجى ملء جميع الحقول المطلوبة", "error");
                      return;
                    }
                    if (manualOrderForm.items.some((i) => !i.productId)) {
                      pushToast("يرجى اختيار منتج لكل سطر", "error");
                      return;
                    }
                    setManualOrderSaving(true);
                    try {
                      await orderService.createOrder({
                        customer: {
                          fullName: manualOrderForm.fullName,
                          phone: manualOrderForm.phone,
                          phone2: manualOrderForm.phone2 || undefined,
                          wilayaCode: manualOrderForm.wilayaCode,
                          commune: manualOrderForm.commune,
                          address: manualOrderForm.address,
                        },
                        items: manualOrderForm.items.map((i) => ({
                          productId: i.productId,
                          variantId: i.variantId || "",
                          quantity: Number(i.quantity) || 1,
                        })),
                        deliveryType: manualOrderForm.deliveryType,
                        promoCode: manualOrderForm.promoCode || undefined,
                        manualConfirm: true,
                      });
                      pushToast("تم إنشاء الطلب بنجاح", "success");
                      setManualOrderForm({ fullName: "", phone: "", phone2: "", wilayaCode: "", commune: "", address: "", deliveryType: "HOME_DELIVERY", promoCode: "", items: [{ productId: "", variantId: "", quantity: "1" }] });
                      setShowManualOrderForm(false);
                      await loadAll();
                    } catch (error) {
                      pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error");
                    } finally {
                      setManualOrderSaving(false);
                    }
                  }}
                  className="primary-button gap-2"
                >
                  {manualOrderSaving ? "جارٍ الحفظ..." : "إنشاء الطلب"}
                </button>
                <button type="button" onClick={() => setShowManualOrderForm(false)} className="ghost-button">
                  إلغاء
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Filter bar */}
        <div className="admin-panel py-4 px-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={orderFilters.orderNumber}
              onChange={(e) => setOrderFilters((c) => ({ ...c, orderNumber: e.target.value }))}
              className="field-input min-w-[110px] flex-1 py-2 text-sm"
              placeholder="Order #"
            />
            <select
              value={orderFilters.status}
              onChange={(e) => setOrderFilters((c) => ({ ...c, status: e.target.value }))}
              className="field-select min-w-[140px] flex-1 py-2 text-sm"
            >
              <option value="all">{translate(language, "filterAllStatuses")}</option>
              {orderStatusOptions.map((s) => (
                <option key={s} value={s}>{translate(language, `status_${s}` as TranslationKey)}</option>
              ))}
            </select>
            <select
              value={orderFilters.wilaya}
              onChange={(e) => setOrderFilters((c) => ({ ...c, wilaya: e.target.value }))}
              className="field-select min-w-[130px] flex-1 py-2 text-sm"
            >
              <option value="all">{translate(language, "filterAllWilayas")}</option>
              {[...new Set(orders.map((o) =>
                typeof o.customer.wilaya === "string"
                  ? o.customer.wilaya
                  : language === "ar" ? o.customer.wilaya.name.ar : language === "fr" ? o.customer.wilaya.name.fr : o.customer.wilaya.name.en,
              ))].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <input
              type="date"
              value={orderFilters.date}
              onChange={(e) => setOrderFilters((c) => ({ ...c, date: e.target.value }))}
              className="field-input min-w-[130px] flex-1 py-2 text-sm"
            />
            <input
              value={orderFilters.phone}
              onChange={(e) => setOrderFilters((c) => ({ ...c, phone: e.target.value }))}
              className="field-input min-w-[130px] flex-1 py-2 text-sm"
              placeholder={translate(language, "filterPhonePlaceholder")}
            />
            <div className="ms-auto flex shrink-0 flex-wrap items-center gap-2">
              <span className="text-sm text-slate-400">{filteredOrders.length} {translate(language, "orders")}</span>
              <button type="button" onClick={exportOrdersCSV} className="ghost-button gap-1.5 px-3 py-2 text-sm">
                <BarChart3 className="h-4 w-4" /> CSV
              </button>
              {selectedOrderIds.size > 0 && (
                <button
                  type="button"
                  disabled={bulkLabelPrinting}
                  onClick={() => void printBulkLabels()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  {bulkLabelPrinting
                    ? (language === "ar" ? "جارٍ التحميل..." : language === "fr" ? "Chargement..." : "Downloading...")
                    : `${language === "ar" ? "طباعة" : language === "fr" ? "Imprimer" : "Print"} ${selectedOrderIds.size} ${language === "ar" ? "وصل" : language === "fr" ? "bons" : "labels"}`}
                </button>
              )}
              {[...selectedOrderIds].some((id) => ordersById.get(id)?.zrParcelId) && (
                <button
                  type="button"
                  disabled={bulkReadyToShipping}
                  onClick={() => void bulkReadyToShipAction()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  <Truck className="h-4 w-4" />
                  {bulkReadyToShipping ? "جارٍ..." : `جاهز للشحن للكل (${selectedOrderIds.size})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Orders table */}
        <div className="table-wrap">
          {filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">{emptyText}</div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-6 ps-5" />
                  <th className="w-8 ps-1">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer rounded"
                      checked={filteredOrders.filter((o) => o.zrTrackingNumber).every((o) => selectedOrderIds.has(o._id)) && filteredOrders.some((o) => o.zrTrackingNumber)}
                      onChange={(e) => {
                        const withTracking = filteredOrders.filter((o) => o.zrTrackingNumber).map((o) => o._id);
                        setSelectedOrderIds(e.target.checked ? new Set(withTracking) : new Set());
                      }}
                      title={language === "ar" ? "تحديد كل الطلبات بوصل" : "Select all with tracking"}
                    />
                  </th>
                  <th>{colOrder}</th>
                  <th>{colCustomer}</th>
                  <th>{colPhone}</th>
                  <th>{colStatus}</th>
                  <th>{colTotal}</th>
                  <th>{colDate}</th>
                  <th className="w-8 pe-5" />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const busy = orderActionId === order._id;
                  const urgent = order.status === "AWAITING_CALL_CONFIRMATION" || order.status === "PENDING_AI_CONFIRMATION";
                  const isExpanded = expandedOrderId === order._id;
                  const wilayaLabel =
                    typeof order.customer.wilaya === "string"
                      ? order.customer.wilaya
                      : language === "ar"
                        ? order.customer.wilaya.name.ar
                        : language === "fr"
                          ? order.customer.wilaya.name.fr
                          : order.customer.wilaya.name.en;

                  const quickActions =
                    order.status === "AWAITING_CALL_CONFIRMATION" || order.status === "PENDING_AI_CONFIRMATION"
                      ? [{ status: "CONFIRMED" as const, icon: Check }, { status: "PROCESSING" as const, icon: Store }, { status: "CANCELLED" as const, icon: X }]
                      : order.status === "CONFIRMED"
                        ? [{ status: "PROCESSING" as const, icon: Store }, { status: "CANCELLED" as const, icon: X }]
                        : order.status === "PROCESSING"
                          ? [{ status: "SHIPPED" as const, icon: Truck }, { status: "CANCELLED" as const, icon: X }]
                          : order.status === "SHIPPED"
                            ? [{ status: "DELIVERED" as const, icon: Shield }, { status: "RETURNED" as const, icon: AlertTriangle }]
                            : [];

                  return (
                    <Fragment key={order._id}>
                      <tr
                        onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}
                        className={`cursor-pointer transition-colors ${urgent ? "bg-amber-50/50 hover:bg-amber-50" : isExpanded ? "bg-slate-50" : "hover:bg-slate-50/70"}`}
                      >
                        <td className="ps-5 py-3.5">
                          <span
                            className={`block h-2.5 w-2.5 rounded-full ${
                              urgent
                                ? "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]"
                                : order.status === "DELIVERED" || order.status === "PICKED_UP"
                                  ? "bg-emerald-400"
                                  : order.status === "CANCELLED" || order.status === "RETURNED" || order.status === "FAILED"
                                    ? "bg-rose-400"
                                    : "bg-slate-300"
                            }`}
                          />
                        </td>
                        <td className="ps-1 py-3.5">
                          {order.zrTrackingNumber ? (
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 cursor-pointer rounded"
                              checked={selectedOrderIds.has(order._id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedOrderIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(order._id);
                                  else next.delete(order._id);
                                  return next;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
                        </td>
                        <td className="py-3.5 font-mono text-xs font-semibold text-slate-600">{order.orderNumber}</td>
                        <td className="py-3.5">
                          <div className="text-sm font-semibold leading-tight text-slate-950">{order.customer.fullName}</div>
                          <div className="mt-0.5 text-xs text-slate-400">{wilayaLabel}{order.customer.commune ? ` · ${order.customer.commune}` : ""}</div>
                        </td>
                        <td className="py-3.5">
                          <a
                            href={`tel:${order.customer.phone}`}
                            className="text-sm font-medium text-teal-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order.customer.phone}
                          </a>
                        </td>
                        <td className="py-3.5">
                          <StatusBadge label={order.status} language={language} />
                        </td>
                        <td className="whitespace-nowrap py-3.5 text-sm font-bold text-slate-950">{formatCurrency(order.total, language)}</td>
                        <td className="whitespace-nowrap py-3.5 text-xs text-slate-400">{formatDate(order.createdAt, language)}</td>
                        <td className="pe-5 py-3.5 text-end">
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className={urgent ? "bg-amber-50/30" : "bg-slate-50/60"}>
                          <td colSpan={2} />
                          <td colSpan={7} className="pb-5 pe-5 pt-1">
                            {/* Products */}
                            <div className="mb-3 flex flex-wrap gap-2">
                              {order.items.map((item) => (
                                <span
                                  key={`${order._id}-${item.productId}-${item.variantId ?? item.variantLabel}`}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                                >
                                  {getLocalizedText(item.productName, language)}
                                  {item.variantLabel ? <span className="text-slate-400">· {item.variantLabel}</span> : null}
                                  <span className="ms-0.5 font-bold text-slate-950">×{item.quantity}</span>
                                </span>
                              ))}
                            </div>

                            {/* ZR Express tracking */}
                            {order.zrTrackingNumber ? (
                              <div className="mb-3 space-y-2">
                                {/* Tracking badge + action buttons */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                    <Truck className="h-3.5 w-3.5" />
                                    ZR: {order.zrTrackingNumber}
                                  </span>

                                  {/* Print label */}
                                  <button
                                    type="button"
                                    disabled={printLabelId === order._id}
                                    onClick={(e) => { e.stopPropagation(); void printLabelAction(order._id, order.zrTrackingNumber ?? order.orderNumber); }}
                                    className="ghost-button gap-1.5 px-3 py-1.5 text-xs"
                                  >
                                    {printLabelId === order._id
                                      ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                                      : <Printer className="h-3.5 w-3.5" />}
                                    {language === "ar" ? "طباعة الوصل" : language === "fr" ? "Imprimer le bon" : "Print Waybill"}
                                  </button>

                                  {/* Send to Telegram */}
                                  <button
                                    type="button"
                                    disabled={telegramLabelId === order._id}
                                    onClick={(e) => { e.stopPropagation(); void sendLabelToTelegramAction(order._id); }}
                                    className="ghost-button gap-1.5 px-3 py-1.5 text-xs"
                                    title="Send waybill to Telegram"
                                  >
                                    {telegramLabelId === order._id ? (
                                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                                    ) : (
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
                                    )}
                                    {language === "ar" ? "إرسال إلى Telegram" : language === "fr" ? "Envoyer Telegram" : "Send to Telegram"}
                                  </button>

                                  {/* Sync from ZR */}
                                  <button
                                    type="button"
                                    disabled={zrSyncingId === order._id}
                                    onClick={(e) => { e.stopPropagation(); void syncZRStatusAction(order._id); }}
                                    className="ghost-button gap-1.5 px-3 py-1.5 text-xs"
                                    title="Refresh status from ZR"
                                  >
                                    <svg className={`h-3.5 w-3.5 ${zrSyncingId === order._id ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                                    {language === "ar" ? "تحديث الحالة" : language === "fr" ? "Actualiser" : "Sync Status"}
                                  </button>

                                  {/* Change ZR state directly */}
                                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      disabled={zrStateChangingId === order._id}
                                      defaultValue=""
                                      onChange={(e) => {
                                        const stateId = e.target.value;
                                        if (!stateId) return;
                                        const labels: Record<string, string> = {
                                          "8a948c66-1ab7-4433-aeb0-94219125d134": "جاهز للشحن",
                                        };
                                        void setZRStateAction(order._id, stateId, labels[stateId] ?? stateId);
                                        e.target.value = "";
                                      }}
                                      className="h-7 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm hover:border-blue-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 disabled:opacity-50"
                                    >
                                      <option value="" disabled>
                                        {zrStateChangingId === order._id
                                          ? (language === "ar" ? "جارٍ التغيير..." : "Changing...")
                                          : (language === "ar" ? "تغيير حالة ZR" : "Set ZR State")}
                                      </option>
                                      <option value="8a948c66-1ab7-4433-aeb0-94219125d134">جاهز للشحن (Prêt à expédier)</option>
                                    </select>
                                  </div>

                                  {/* Cancel ZR parcel */}
                                  <button
                                    type="button"
                                    disabled={zrCancellingId === order._id}
                                    onClick={(e) => { e.stopPropagation(); cancelZRParcelAction(order._id, order.orderNumber); }}
                                    className="ghost-button gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    {zrCancellingId === order._id
                                      ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                                      : <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>}
                                    {language === "ar" ? "إلغاء ZR" : "Cancel ZR"}
                                  </button>

                                  {/* Toggle history */}
                                  <button
                                    type="button"
                                    disabled={zrHistoryLoading === order._id}
                                    onClick={(e) => { e.stopPropagation(); void loadZRHistory(order._id); }}
                                    className={`ghost-button gap-1.5 px-3 py-1.5 text-xs ${zrHistory[order._id] ? "font-semibold text-slate-950" : ""}`}
                                  >
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    {zrHistoryLoading === order._id
                                      ? (language === "ar" ? "جارٍ التحميل..." : "Loading...")
                                      : zrHistory[order._id]
                                        ? (language === "ar" ? "إخفاء السجل" : language === "fr" ? "Masquer l'historique" : "Hide History")
                                        : (language === "ar" ? "سجل التتبع" : language === "fr" ? "Historique" : "Track History")}
                                  </button>
                                </div>

                                {/* ZR history timeline */}
                                {zrHistory[order._id] && (
                                  <div className="ms-1 border-s-2 border-emerald-100 ps-4 space-y-2">
                                    {zrHistory[order._id].length === 0 ? (
                                      <p className="text-xs text-slate-400">{language === "ar" ? "لا يوجد سجل بعد" : "No history yet"}</p>
                                    ) : (
                                      zrHistory[order._id].map((entry, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                                          <div>
                                            <div className="text-[11px] font-semibold text-slate-800">
                                              {language === "ar" ? getZRStateAr(entry.state, entry.stateAr) : entry.state}
                                            </div>
                                            <div className="text-[10px] text-slate-400">{entry.date ? new Date(entry.date).toLocaleString(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-DZ" : "en-DZ") : ""}</div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : zrStatus?.configured && (order.status === "CONFIRMED" || order.status === "PROCESSING") ? (
                              <div className="mb-3">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(e) => { e.stopPropagation(); confirmCreateZRParcel(order._id, order.orderNumber); }}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                                >
                                  <Package className="h-3.5 w-3.5" />
                                  {language === "ar" ? "إنشاء شحنة ZR" : language === "fr" ? "Créer colis ZR" : "Create ZR parcel"}
                                </button>
                              </div>
                            ) : null}

                            {/* Phone2 backup number */}
                            {order.customer.phone2 ? (
                              <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <a href={`tel:${order.customer.phone2}`} className="font-medium text-teal-600 hover:underline" dir="ltr" onClick={(e) => e.stopPropagation()}>{order.customer.phone2}</a>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-400">{language === "ar" ? "رقم بديل" : language === "fr" ? "N° alternatif" : "Backup"}</span>
                              </div>
                            ) : null}

                            {/* Address + delivery type */}
                            {order.customer.address ? (
                              <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span>{order.customer.address}</span>
                                <span className="ms-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  {order.deliveryType === "HOME_DELIVERY" ? translate(language, "homeDelivery") : translate(language, "deskPickup")}
                                </span>
                              </div>
                            ) : null}

                            {/* Admin note */}
                            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                              {orderNoteEditing === order._id ? (
                                <div className="flex items-start gap-2">
                                  <textarea
                                    autoFocus
                                    value={orderNoteDraft}
                                    onChange={(e) => setOrderNoteDraft(e.target.value)}
                                    rows={2}
                                    className="field-input flex-1 resize-none text-xs"
                                    placeholder={language === "ar" ? "ملاحظة على الطلب..." : "Order note..."}
                                  />
                                  <div className="flex flex-col gap-1">
                                    <button type="button" onClick={() => void saveOrderNote(order._id, orderNoteDraft)} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">{language === "ar" ? "حفظ" : "Save"}</button>
                                    <button type="button" onClick={() => setOrderNoteEditing(null)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50">{language === "ar" ? "إلغاء" : "Cancel"}</button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setOrderNoteEditing(order._id); setOrderNoteDraft(order.adminNote ?? ""); }}
                                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${order.adminNote ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"}`}
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  {order.adminNote ? order.adminNote : (language === "ar" ? "إضافة ملاحظة" : "Add note")}
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={order.status}
                                onChange={(e) => { e.stopPropagation(); confirmUpdateStatus(order._id, e.target.value as Order["status"], order.orderNumber); }}
                                disabled={busy}
                                className="field-select max-w-[200px] py-2 text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {orderStatusOptions.map((s) => (
                                  <option key={s} value={s}>{translate(language, `status_${s}` as TranslationKey)}</option>
                                ))}
                              </select>
                              {quickActions.map((action) => {
                                const Icon = action.icon;
                                return (
                                  <button
                                    key={action.status}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); confirmUpdateStatus(order._id, action.status, order.orderNumber); }}
                                    disabled={busy}
                                    className="ghost-button gap-1.5 px-4 py-2 text-sm"
                                  >
                                    <Icon className="h-4 w-4" />
                                    {translate(language, `status_${action.status}` as TranslationKey)}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); printReceiptAction(order); }}
                                className="ghost-button gap-1.5 px-4 py-2 text-sm"
                                title={language === "ar" ? "طباعة الوصل" : language === "fr" ? "Imprimer le reçu" : "Print Receipt"}
                              >
                                <Printer className="h-4 w-4" />
                                {language === "ar" ? "وصل" : language === "fr" ? "Reçu" : "Receipt"}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); confirmDeleteOrder(order._id, order.orderNumber); }}
                                disabled={busy}
                                className="ms-auto rounded-full px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                              >
                                {translate(language, "adminDelete")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Load more */}
        {orders.length < ordersTotal && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <span className="text-sm text-slate-400">
              {language === "ar" ? `${orders.length} من ${ordersTotal} طلب` : language === "fr" ? `${orders.length} sur ${ordersTotal} commandes` : `${orders.length} of ${ordersTotal} orders`}
            </span>
            <button
              type="button"
              disabled={ordersLoadingMore}
              onClick={() => {
                setOrdersLoadingMore(true);
                adminService.getOrders(token, orders.length, 100)
                  .then((result) => {
                    setOrders((prev) => [...prev, ...result.orders]);
                    setOrdersTotal(result.total);
                  })
                  .catch((err: unknown) => pushToast(err instanceof ApiError ? err.message : translate(language, "adminActionError"), "error"))
                  .finally(() => setOrdersLoadingMore(false));
              }}
              className="ghost-button gap-2 px-4 py-2 text-sm"
            >
              {ordersLoadingMore
                ? (language === "ar" ? "جارٍ التحميل..." : language === "fr" ? "Chargement..." : "Loading...")
                : (language === "ar" ? "تحميل المزيد" : language === "fr" ? "Charger plus" : "Load more")}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderShipping = () => (
    <div className="grid gap-4 xl:grid-cols-2">
      {wilayas.map((wilaya) => (
        <div key={wilaya._id} className="surface-card p-5">
          <div className="text-lg font-semibold text-slate-950">
            {wilaya.code} · {language === "ar" ? wilaya.name.ar : language === "fr" ? wilaya.name.fr : wilaya.name.en}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={shippingDrafts[wilaya._id]?.homeDeliveryFee || ""}
              onChange={(event) =>
                setShippingDrafts((current) => ({
                  ...current,
                  [wilaya._id]: { ...current[wilaya._id], homeDeliveryFee: event.target.value, deskPickupFee: current[wilaya._id]?.deskPickupFee || String(wilaya.deskPickupFee) },
                }))
              }
              className="field-input"
              placeholder={translate(language, "homeDelivery")}
            />
            <input
              value={shippingDrafts[wilaya._id]?.deskPickupFee || ""}
              onChange={(event) =>
                setShippingDrafts((current) => ({
                  ...current,
                  [wilaya._id]: { ...current[wilaya._id], deskPickupFee: event.target.value, homeDeliveryFee: current[wilaya._id]?.homeDeliveryFee || String(wilaya.homeDeliveryFee) },
                }))
              }
              className="field-input"
              placeholder={translate(language, "deskPickup")}
            />
          </div>
          <button
            onClick={() =>
              void adminService
                .updateWilaya(token, wilaya._id, {
                  homeDeliveryFee: Number(shippingDrafts[wilaya._id]?.homeDeliveryFee || wilaya.homeDeliveryFee),
                  deskPickupFee: Number(shippingDrafts[wilaya._id]?.deskPickupFee || wilaya.deskPickupFee),
                })
                .then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
            }
            className="primary-button mt-4"
          >
            {translate(language, "adminSave")}
          </button>
        </div>
      ))}
    </div>
  );

  const renderPromos = () => (
    <div className="space-y-6">
      <Panel title={translate(language, "adminPromoTitle")} description={translate(language, "adminPromoCreateDescription")}>
        <div className="grid gap-4 md:grid-cols-4">
          <input value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })} className="field-input uppercase" placeholder={translate(language, "promoCode")} />
          <select value={promoForm.type} onChange={(event) => setPromoForm({ ...promoForm, type: event.target.value })} className="field-select">
            {["FIXED", "PERCENTAGE", "FREE_SHIPPING"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <input value={promoForm.value} onChange={(event) => setPromoForm({ ...promoForm, value: event.target.value })} className="field-input" placeholder={translate(language, "adminBasePrice")} />
          <input value={promoForm.minimumOrderAmount} onChange={(event) => setPromoForm({ ...promoForm, minimumOrderAmount: event.target.value })} className="field-input" placeholder={translate(language, "subtotal")} />
          <input value={promoForm.usageLimit} onChange={(event) => setPromoForm({ ...promoForm, usageLimit: event.target.value })} className="field-input" placeholder={translate(language, "adminPromoUsageLimit")} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">{translate(language, "adminPromoExpiry")}</label>
            <input type="date" value={promoForm.expiresAt} onChange={(event) => setPromoForm({ ...promoForm, expiresAt: event.target.value })} className="field-input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">{translate(language, "adminPromoAffiliate")}</label>
            <select value={promoForm.affiliate} onChange={(event) => setPromoForm({ ...promoForm, affiliate: event.target.value })} className="field-select">
              <option value="">{translate(language, "adminPromoGeneral")}</option>
              {affiliates.map((affiliate) => (
                <option key={affiliate._id} value={affiliate._id}>
                  {affiliate.name} ({affiliate.referralCode})
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs leading-6 text-slate-500">{translate(language, "adminPromoAffiliateHint")}</p>
        <button
          onClick={() =>
            void adminService
              .createPromoCode(token, {
                code: promoForm.code,
                type: promoForm.type as PromoCode["type"],
                value: Number(promoForm.value),
                minimumOrderAmount: Number(promoForm.minimumOrderAmount),
                usageLimit: promoForm.usageLimit ? Number(promoForm.usageLimit) : null,
                expiresAt: promoForm.expiresAt || null,
                affiliate: promoForm.affiliate || undefined,
                isActive: true,
                usedCount: 0,
                productRestrictions: [],
                categoryRestrictions: [],
                oneUsePerPhone: true,
              })
              .then(async () => {
                setPromoForm({ code: "", type: "FIXED", value: "1000", minimumOrderAmount: "0", usageLimit: "", expiresAt: "", affiliate: "" });
                await loadAll();
              })
              .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
          }
          className="primary-button mt-4"
        >
          {translate(language, "adminCreate")}
        </button>
      </Panel>

      {/* Promo search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={promoSearch}
          onChange={(event) => setPromoSearch(event.target.value)}
          className="field-input max-w-xs"
          placeholder="بحث بالكود..."
        />
        <select value={promoStatusFilter} onChange={(event) => setPromoStatusFilter(event.target.value)} className="field-select max-w-[10rem]">
          <option value="all">جميع الحالات</option>
          <option value="active">مفعّل</option>
          <option value="inactive">معطّل</option>
        </select>
        <span className="text-sm text-slate-500">
          {promos.filter((promo) => {
            const q = promoSearch.toLowerCase();
            const isExpired = Boolean(promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now());
            const isExhausted = Boolean(promo.usageLimit && promo.usedCount >= promo.usageLimit);
            const isActive = promo.isActive && !isExpired && !isExhausted;
            if (promoStatusFilter === "active" && !isActive) return false;
            if (promoStatusFilter === "inactive" && isActive) return false;
            return !q || promo.code.toLowerCase().includes(q);
          }).length} نتيجة
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {promos.filter((promo) => {
          const q = promoSearch.toLowerCase();
          const isExpired = Boolean(promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now());
          const isExhausted = Boolean(promo.usageLimit && promo.usedCount >= promo.usageLimit);
          const isActive = promo.isActive && !isExpired && !isExhausted;
          if (promoStatusFilter === "active" && !isActive) return false;
          if (promoStatusFilter === "inactive" && isActive) return false;
          return !q || promo.code.toLowerCase().includes(q);
        }).map((promo) => {
          const draft = promoDrafts[promo._id];
          const isEditing = editingPromoId === promo._id;

          if (isEditing && draft) {
            return (
              <div key={promo._id} className="surface-card space-y-3 p-5">
                <div className="text-lg font-semibold text-slate-950">{promo.code}</div>
                <select value={draft.type} onChange={(event) => setPromoDrafts((current) => ({ ...current, [promo._id]: { ...draft, type: event.target.value } }))} className="field-select">
                  {["FIXED", "PERCENTAGE", "FREE_SHIPPING"].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <input value={draft.value} onChange={(event) => setPromoDrafts((current) => ({ ...current, [promo._id]: { ...draft, value: event.target.value } }))} className="field-input" placeholder={translate(language, "adminBasePrice")} />
                <input value={draft.usageLimit} onChange={(event) => setPromoDrafts((current) => ({ ...current, [promo._id]: { ...draft, usageLimit: event.target.value } }))} className="field-input" placeholder={translate(language, "adminPromoUsageLimit")} />
                <input type="date" value={draft.expiresAt} onChange={(event) => setPromoDrafts((current) => ({ ...current, [promo._id]: { ...draft, expiresAt: event.target.value } }))} className="field-input" />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">{translate(language, "adminPromoAffiliate")}</label>
                  <select value={draft.affiliate} onChange={(event) => setPromoDrafts((current) => ({ ...current, [promo._id]: { ...draft, affiliate: event.target.value } }))} className="field-select">
                    <option value="">{translate(language, "adminPromoGeneral")}</option>
                    {affiliates.map((affiliate) => (
                      <option key={affiliate._id} value={affiliate._id}>
                        {affiliate.name} ({affiliate.referralCode})
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) => setPromoDrafts((current) => ({ ...current, [promo._id]: { ...draft, isActive: event.target.checked } }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {translate(language, "enabled")}
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      void adminService
                        .updatePromoCode(token, promo._id, {
                          type: draft.type as PromoCode["type"],
                          value: Number(draft.value),
                          usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
                          expiresAt: draft.expiresAt || null,
                          isActive: draft.isActive,
                          affiliate: draft.affiliate || null,
                        })
                        .then(async () => {
                          setEditingPromoId(null);
                          await loadAll();
                        })
                        .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                    }
                    className="primary-button"
                  >
                    {translate(language, "adminSave")}
                  </button>
                  <button type="button" onClick={() => setEditingPromoId(null)} className="ghost-button">
                    {translate(language, "adminCancel")}
                  </button>
                </div>
              </div>
            );
          }

          const isExpired = Boolean(promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now());
          const isExhausted = Boolean(promo.usageLimit && promo.usedCount >= promo.usageLimit);

          return (
            <div key={promo._id} className="surface-card p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-semibold text-slate-950">{promo.code}</div>
                {promo.isActive && !isExpired && !isExhausted ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{translate(language, "enabled")}</span>
                ) : (
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{translate(language, "disabled")}</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {promo.type} · {promo.value}
                {promo.minimumOrderAmount ? ` · ${translate(language, "subtotal")} >= ${formatCurrency(promo.minimumOrderAmount, language)}` : ""}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {translate(language, "adminPromoUsageLimit")}: {promo.usedCount}{promo.usageLimit ? ` / ${promo.usageLimit}` : ` (${translate(language, "adminPromoUnlimited")})`}
              </div>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                <Link2 className="h-3.5 w-3.5" />
                {promo.affiliate && typeof promo.affiliate !== "string"
                  ? `${translate(language, "adminPromoAffiliate")}: ${promo.affiliate.name}`
                  : translate(language, "adminPromoGeneral")}
              </div>
              {promo.expiresAt ? (
                <div className={`mt-1 text-sm ${isExpired ? "text-rose-600" : "text-slate-500"}`}>
                  {translate(language, "adminPromoExpiry")}: {formatDate(promo.expiresAt, language)}
                </div>
              ) : null}
              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => setEditingPromoId(promo._id)} className="text-sm font-semibold text-teal-700">
                  {translate(language, "adminEdit")}
                </button>
                <button onClick={() => void adminService.deletePromoCode(token, promo._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="text-sm font-semibold text-rose-600">
                  {translate(language, "adminDelete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAffiliates = () => {
    const pendingAffiliates = affiliates.filter((a) => a.status === "PENDING");
    const activeAffiliates = affiliates.filter((a) => a.status === "ACTIVE");
    const filteredAffiliates = affiliates.filter((affiliate) => {
      const q = affiliateSearch.toLowerCase();
      if (affiliateStatusFilter !== "all" && affiliate.status !== affiliateStatusFilter) return false;
      return !q || affiliate.name.toLowerCase().includes(q) || affiliate.email.toLowerCase().includes(q) || affiliate.phone?.includes(q) || affiliate.referralCode.toLowerCase().includes(q);
    });

    const levelColors: Record<string, string> = {
      BRONZE: "border-amber-300 bg-amber-50 text-amber-800",
      SILVER: "border-slate-300 bg-slate-100 text-slate-700",
      GOLD: "border-yellow-400 bg-yellow-50 text-yellow-800",
      PLATINUM: "border-teal-400 bg-teal-50 text-teal-800",
    };

    return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-bold text-teal-600">{activeAffiliates.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">{language === "ar" ? "نشط" : "Active"}</div>
        </div>
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingAffiliates.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">{language === "ar" ? "في الانتظار" : "Pending"}</div>
        </div>
        <div className="surface-card p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{affiliates.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">{language === "ar" ? "إجمالي" : "Total"}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-panel flex flex-wrap items-center gap-3 py-3 px-4">
        <input
          value={affiliateSearch}
          onChange={(event) => setAffiliateSearch(event.target.value)}
          className="field-input min-w-[200px] flex-1 py-2 text-sm"
          placeholder={language === "ar" ? "بحث بالاسم أو البريد أو الكود..." : "Search name, email, code..."}
        />
        <select value={affiliateStatusFilter} onChange={(event) => setAffiliateStatusFilter(event.target.value)} className="field-select py-2 text-sm max-w-[130px]">
          <option value="all">{language === "ar" ? "الكل" : "All"}</option>
          <option value="PENDING">{language === "ar" ? "انتظار" : "Pending"}</option>
          <option value="ACTIVE">{language === "ar" ? "نشط" : "Active"}</option>
          <option value="BLOCKED">{language === "ar" ? "محظور" : "Blocked"}</option>
        </select>
        {pendingAffiliates.length > 0 && (
          <button
            onClick={() => void Promise.all(
              pendingAffiliates.map((a) => adminService.updateAffiliate(token, a._id, { status: "ACTIVE", commissionRate: a.commissionRate, level: a.level || "BRONZE" }))
            ).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            <Check className="h-4 w-4" />
            {language === "ar" ? `قبول الكل (${pendingAffiliates.length})` : `Approve all (${pendingAffiliates.length})`}
          </button>
        )}
        <span className="text-sm text-slate-400">{filteredAffiliates.length} {language === "ar" ? "مسوّق" : "affiliates"}</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="table-base">
          <thead>
            <tr>
              <th className="ps-5">{language === "ar" ? "المسوّق" : "Affiliate"}</th>
              <th>{language === "ar" ? "المستوى" : "Level"}</th>
              <th>{language === "ar" ? "الرصيد" : "Balance"}</th>
              <th className="hidden md:table-cell">{language === "ar" ? "الكود" : "Code"}</th>
              <th className="hidden lg:table-cell">{language === "ar" ? "المحوِّل" : "Referred by"}</th>
              <th>{language === "ar" ? "الحالة" : "Status"}</th>
              <th>{language === "ar" ? "إجراء" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAffiliates.map((affiliate) => {
              const draft = affiliateDrafts[affiliate._id];
              const level = draft?.level || affiliate.level || "BRONZE";
              const LevelIcon = levelIcons[level];
              const referrer = typeof affiliate.referredBy === "string" ? null : affiliate.referredBy;
              const totalBalance = affiliate.balancePending + affiliate.balanceApproved;
              return (
                <tr key={affiliate._id} className={affiliate.status === "PENDING" ? "bg-amber-50/60" : ""}>
                  {/* Name + contact */}
                  <td className="ps-5">
                    <div className="font-semibold text-slate-950">{affiliate.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{affiliate.email}</div>
                    <div className="text-xs text-slate-400" dir="ltr">{affiliate.phone}</div>
                  </td>

                  {/* Level selector */}
                  <td>
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex items-center gap-1 self-start rounded-full border px-2 py-0.5 text-[10px] font-bold ${levelColors[level] || ""}`}>
                        <LevelIcon className="h-3 w-3" />
                        {level}
                      </span>
                      <select
                        value={level}
                        onChange={(e) => setAffiliateDrafts((c) => ({ ...c, [affiliate._id]: { status: c[affiliate._id]?.status || affiliate.status, commissionRate: c[affiliate._id]?.commissionRate || String(affiliate.commissionRate), level: e.target.value as AffiliateLevel } }))}
                        className="field-select py-1 text-xs max-w-[90px]"
                      >
                        {affiliateLevelOrder.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </td>

                  {/* Balance */}
                  <td>
                    <div className="text-sm font-bold text-slate-950">{formatCurrency(totalBalance, language)}</div>
                    {affiliate.balancePaid > 0 && (
                      <div className="text-[10px] text-slate-400">{language === "ar" ? "مدفوع:" : "Paid:"} {formatCurrency(affiliate.balancePaid, language)}</div>
                    )}
                  </td>

                  {/* Code */}
                  <td className="hidden md:table-cell">
                    <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-mono font-bold text-slate-700">{affiliate.referralCode}</code>
                  </td>

                  {/* Referred by */}
                  <td className="hidden lg:table-cell">
                    {referrer ? (
                      <span className="text-xs text-teal-700 font-medium">↑ {referrer.name}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Status selector */}
                  <td>
                    <select
                      value={draft?.status || affiliate.status}
                      onChange={(e) => setAffiliateDrafts((c) => ({ ...c, [affiliate._id]: { status: e.target.value as Affiliate["status"], commissionRate: c[affiliate._id]?.commissionRate || String(affiliate.commissionRate), level: c[affiliate._id]?.level || affiliate.level || "BRONZE" } }))}
                      className="field-select py-1 text-xs max-w-[100px]"
                    >
                      {["PENDING", "ACTIVE", "BLOCKED"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>

                  {/* Save button */}
                  <td>
                    <button
                      onClick={() => void adminService.updateAffiliate(token, affiliate._id, {
                        status: draft?.status || affiliate.status,
                        commissionRate: Number(draft?.commissionRate || affiliate.commissionRate),
                        level: draft?.level || affiliate.level || "BRONZE",
                      }).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))}
                      className="ghost-button px-3 py-1.5 text-xs"
                    >
                      {translate(language, "adminSave")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredAffiliates.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">{language === "ar" ? "لا يوجد مسوّقون" : "No affiliates found"}</div>
        )}
      </div>
    </div>
    );
  };

  const renderCommissions = () => {
    const filteredCommissions = commissions.filter((c) =>
      commissionStatusFilter === "all" || c.status === commissionStatusFilter
    );
    const pendingCommissions = commissions.filter((c) => c.status === "APPROVED");
    return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={commissionStatusFilter} onChange={(event) => setCommissionStatusFilter(event.target.value)} className="field-select max-w-[12rem]">
          <option value="all">جميع الحالات</option>
          <option value="PENDING">في الانتظار</option>
          <option value="APPROVED">موافق عليه</option>
          <option value="PAID">مدفوع</option>
        </select>
        {pendingCommissions.length > 0 ? (
          <button
            onClick={() =>
              void Promise.all(pendingCommissions.map((c) => adminService.markCommissionPaid(token, c._id)))
                .then(loadAll)
                .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
            }
            className="primary-button gap-2"
          >
            <Check className="h-4 w-4" />
            تحديد الكل مدفوع ({pendingCommissions.length})
          </button>
        ) : null}
        <span className="text-sm text-slate-500">{filteredCommissions.length} عمولة</span>
      </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {filteredCommissions.map((commission) => {
        const orderId = typeof commission.order === "string" ? commission.order : commission.order?._id;
        const order = orderId ? ordersById.get(orderId) : undefined;
        const affiliateName = typeof commission.affiliate === "string" ? commission.affiliate : commission.affiliate?.name ?? "";

        return (
          <div key={commission._id} className="surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-950">{affiliateName}</div>
                <div className="mt-1 text-sm text-slate-500">{order?.orderNumber || orderId}</div>
              </div>
              <StatusBadge label={commission.status} language={language} />
            </div>
            <div className="mt-4 text-sm text-slate-600">
              {formatCurrency(commission.amount, language)} at {commission.rate}%
            </div>
            {commission.status !== "PAID" ? (
              <button onClick={() => void adminService.markCommissionPaid(token, commission._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="primary-button mt-4">
                {translate(language, "adminMarkPaid")}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
    </div>
    );
  };

  const renderWithdrawals = () => {
    const filteredWithdrawals = [...withdrawals]
      .filter((w) => withdrawalStatusFilter === "all" || w.status === withdrawalStatusFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return (
    <div className="space-y-4">
      <Panel title={translate(language, "adminWithdrawalsTitle")} description={translate(language, "adminWithdrawalsDescription")}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={withdrawalStatusFilter} onChange={(event) => setWithdrawalStatusFilter(event.target.value)} className="field-select max-w-[12rem]">
            <option value="all">جميع الحالات</option>
            <option value="PENDING">في الانتظار</option>
            <option value="APPROVED">موافق عليه</option>
            <option value="PAID">مدفوع</option>
            <option value="REJECTED">مرفوض</option>
          </select>
          <span className="text-sm text-slate-500">{filteredWithdrawals.length} طلب</span>
        </div>
        {filteredWithdrawals.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredWithdrawals.map((withdrawal) => {
              const affiliate = typeof withdrawal.affiliate === "string" ? null : withdrawal.affiliate;
              return (
                <div key={withdrawal._id} className="surface-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-lg font-semibold text-slate-950">{formatCurrency(withdrawal.amount, language)}</div>
                    <StatusBadge label={withdrawal.status} language={language} />
                  </div>
                  {affiliate ? (
                    <div className="mt-2 grid gap-1 text-sm text-slate-500">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 shrink-0" />
                        {affiliate.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        {affiliate.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        {affiliate.phone}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-2 text-sm text-slate-500">
                    {withdrawal.method === "RIP" ? translate(language, "affiliateMethodRip") : translate(language, "affiliateMethodCardless")}: {withdrawal.accountInfo}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{formatDate(withdrawal.createdAt, language)}</div>
                  {affiliate ? (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{translate(language, "adminWithdrawalCommissionHistory")}</div>
                      {(() => {
                        const affiliateCommissions = commissions.filter((commission) => commission.affiliate && typeof commission.affiliate !== "string" && commission.affiliate._id === affiliate._id);
                        if (!affiliateCommissions.length) {
                          return <div className="mt-2 text-sm text-slate-500">{translate(language, "adminNoCommissionsForAffiliate")}</div>;
                        }
                        return (
                          <div className="mt-2 space-y-2">
                            {affiliateCommissions.map((commission) => {
                              const orderId = typeof commission.order === "string" ? commission.order : commission.order?._id;
                              const order = orderId ? ordersById.get(orderId) : undefined;
                              return (
                                <div key={commission._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <span className="font-medium text-slate-900">{order?.orderNumber || orderId}</span>
                                    {order ? <StatusBadge label={order.status} language={language} /> : null}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-600">{formatCurrency(commission.amount, language)}</span>
                                    <StatusBadge label={commission.status} language={language} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                  {withdrawal.status !== "PAID" ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {withdrawal.status !== "APPROVED" ? (
                        <button
                          onClick={() =>
                            void adminService
                              .updateWithdrawal(token, withdrawal._id, "APPROVED")
                              .then(loadAll)
                              .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                          }
                          className="ghost-button"
                        >
                          {translate(language, "adminWithdrawalApprove")}
                        </button>
                      ) : null}
                      <button
                        onClick={() =>
                          void adminService
                            .updateWithdrawal(token, withdrawal._id, "PAID")
                            .then(loadAll)
                            .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                        }
                        className="primary-button"
                      >
                        {translate(language, "adminMarkPaid")}
                      </button>
                      {withdrawal.status !== "REJECTED" ? (
                        <button
                          onClick={() =>
                            void adminService
                              .updateWithdrawal(token, withdrawal._id, "REJECTED")
                              .then(loadAll)
                              .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                          }
                          className="text-sm font-semibold text-rose-600"
                        >
                          {translate(language, "adminWithdrawalReject")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title={translate(language, "adminWithdrawalsTitle")} description={translate(language, "adminNoWithdrawals")} />
        )}
      </Panel>
    </div>
    );
  };

  const renderCouponRequests = () => {
    const filteredCoupons = couponRequests.filter(
      (r) => couponStatusFilter === "all" || r.status === couponStatusFilter
    );
    return (
    <div className="space-y-4">
      <Panel title={translate(language, "adminCouponRequestsTitle")} description={translate(language, "adminCouponRequestsDescription")}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={couponStatusFilter} onChange={(event) => setCouponStatusFilter(event.target.value)} className="field-select max-w-[12rem]">
            <option value="PENDING">في الانتظار</option>
            <option value="APPROVED">موافق عليه</option>
            <option value="REJECTED">مرفوض</option>
            <option value="all">الكل</option>
          </select>
          <span className="text-sm text-slate-500">{filteredCoupons.length} طلب</span>
        </div>
        {filteredCoupons.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredCoupons.map((request) => {
              const affiliate = typeof request.affiliate === "string" ? null : request.affiliate;
              const draft = couponDrafts[request._id] || { code: request.desiredCode || "", adminNote: request.adminNote || "" };
              return (
                <div key={request._id} className="surface-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-lg font-semibold text-slate-950">{affiliate?.name}</div>
                    <StatusBadge label={request.status} language={language} />
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {request.type === "FREE_SHIPPING"
                      ? translate(language, "freeShipping")
                      : request.type === "PERCENTAGE"
                        ? `${request.value}%`
                        : formatCurrency(request.value, language)}
                    {request.desiredCode ? ` · ${request.desiredCode}` : ""}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{request.reason}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(request.createdAt, language)}</div>
                  {request.status === "PENDING" ? (
                    <div className="mt-4 space-y-3">
                      <input
                        value={draft.code}
                        onChange={(event) => setCouponDrafts((current) => ({ ...current, [request._id]: { ...draft, code: event.target.value.toUpperCase() } }))}
                        className="field-input uppercase"
                        placeholder={translate(language, "affiliateDesiredCode")}
                      />
                      <textarea
                        value={draft.adminNote}
                        onChange={(event) => setCouponDrafts((current) => ({ ...current, [request._id]: { ...draft, adminNote: event.target.value } }))}
                        className="field-input"
                        rows={2}
                        placeholder={translate(language, "adminCouponRequestNote")}
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            void adminService
                              .updateCouponRequest(token, request._id, { status: "APPROVED", code: draft.code.trim() || undefined, adminNote: draft.adminNote.trim() || undefined })
                              .then(loadAll)
                              .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                          }
                          className="primary-button gap-2"
                        >
                          <Check className="h-4 w-4" />
                          {translate(language, "adminApprove")}
                        </button>
                        <button
                          onClick={() =>
                            void adminService
                              .updateCouponRequest(token, request._id, { status: "REJECTED", adminNote: draft.adminNote.trim() || undefined })
                              .then(loadAll)
                              .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                          }
                          className="ghost-button gap-2 text-rose-600"
                        >
                          <X className="h-4 w-4" />
                          {translate(language, "adminWithdrawalReject")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {request.promoCode && typeof request.promoCode !== "string" ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <Gift className="h-3.5 w-3.5" />
                          {request.promoCode.code}
                        </div>
                      ) : null}
                      {request.adminNote ? <p className="mt-2 text-xs leading-6 text-slate-500">{request.adminNote}</p> : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title={translate(language, "adminCouponRequestsTitle")} description={translate(language, "adminNoCouponRequests")} />
        )}
      </Panel>
    </div>
    );
  };

  const renderSettings = () =>
    settings ? (
      <div className="space-y-6">
        <Panel title={translate(language, "adminSettingsTitle")}>
          <div className="grid gap-4 md:grid-cols-2">
            <IconField icon={Store}>
              <input value={settings.storeName} onChange={(event) => setSettings({ ...settings, storeName: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "storeName")} />
            </IconField>
            <IconField icon={Phone}>
              <input value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "phone")} />
            </IconField>
            <IconField icon={MessageCircle}>
              <input value={settings.whatsapp || ""} onChange={(event) => setSettings({ ...settings, whatsapp: event.target.value })} className="field-input field-input-icon" placeholder="WhatsApp" />
            </IconField>
            <IconField icon={Mail}>
              <input type="email" value={settings.email || ""} onChange={(event) => setSettings({ ...settings, email: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "adminContactEmail")} />
            </IconField>
            <IconField icon={TicketPercent}>
              <input value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "currency")} />
            </IconField>
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">{translate(language, "adminSiteLogo")}</label>
            <ImageUploadField token={token} value={settings.logo || ""} onChange={(url) => setSettings({ ...settings, logo: url })} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <IconField icon={Building2}>
              <textarea value={settings.address || ""} onChange={(event) => setSettings({ ...settings, address: event.target.value })} rows={2} className="field-textarea field-input-icon" placeholder={translate(language, "adminStoreAddress")} />
            </IconField>
            <IconField icon={MapPin}>
              <input value={settings.mapUrl || ""} onChange={(event) => setSettings({ ...settings, mapUrl: event.target.value })} className="field-input field-input-icon" placeholder={translate(language, "adminMapEmbedUrl")} />
            </IconField>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <IconField icon={Facebook}>
              <input
                value={settings.socialLinks?.facebook || ""}
                onChange={(event) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, facebook: event.target.value } })}
                className="field-input field-input-icon"
                placeholder="Facebook URL"
              />
            </IconField>
            <IconField icon={Instagram}>
              <input
                value={settings.socialLinks?.instagram || ""}
                onChange={(event) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, instagram: event.target.value } })}
                className="field-input field-input-icon"
                placeholder="Instagram URL"
              />
            </IconField>
            <IconField icon={TikTokIcon}>
              <input
                value={settings.socialLinks?.tiktok || ""}
                onChange={(event) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, tiktok: event.target.value } })}
                className="field-input field-input-icon"
                placeholder="TikTok URL"
              />
            </IconField>
            <IconField icon={Youtube}>
              <input
                value={settings.socialLinks?.youtube || ""}
                onChange={(event) => setSettings({ ...settings, socialLinks: { ...settings.socialLinks, youtube: event.target.value } })}
                className="field-input field-input-icon"
                placeholder="YouTube URL"
              />
            </IconField>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => setSettings({ ...settings, aiEnabled: !settings.aiEnabled })} className="ghost-button">
              AI: {settings.aiEnabled ? translate(language, "enabled") : translate(language, "disabled")}
            </button>
            <button onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })} className="ghost-button">
              {translate(language, "maintenanceMode")}: {settings.maintenanceMode ? translate(language, "on") : translate(language, "off")}
            </button>
            <button onClick={() => setSettings({ ...settings, promoCodeEnabled: !settings.promoCodeEnabled })} className="ghost-button">
              {translate(language, "adminPromoCodeFieldToggle")}: {settings.promoCodeEnabled !== false ? translate(language, "on") : translate(language, "off")}
            </button>
            <button
              onClick={() => setSettings({ ...settings, directOrderMode: !settings.directOrderMode })}
              className={`ghost-button gap-2 ${settings.directOrderMode ? "border-teal-400 bg-teal-50 text-teal-800" : ""}`}
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${settings.directOrderMode ? "bg-teal-500" : "bg-slate-300"}`} />
              {language === "ar" ? "الطلب المباشر من صفحة المنتج" : "Direct order on product page"}:
              <strong>{settings.directOrderMode ? (language === "ar" ? "مفعّل" : "ON") : (language === "ar" ? "معطّل" : "OFF")}</strong>
            </button>
            <button
              onClick={() => setSettings({ ...settings, whatsappFloat: settings.whatsappFloat !== false ? false : true })}
              className={`ghost-button gap-2 ${settings.whatsappFloat !== false ? "border-green-400 bg-green-50 text-green-800" : ""}`}
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${settings.whatsappFloat !== false ? "bg-green-500" : "bg-slate-300"}`} />
              {language === "ar" ? "زر واتساب العائم" : "Floating WhatsApp button"}:
              <strong>{settings.whatsappFloat !== false ? (language === "ar" ? "مفعّل" : "ON") : (language === "ar" ? "معطّل" : "OFF")}</strong>
            </button>
            <button
              onClick={() => void adminService.updateSettings(token, settings)
                .then(() => { void loadAll(); refreshSiteSettings(); pushToast(language === "ar" ? "تم الحفظ ✓" : "Saved ✓", "success"); })
                .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))}
              className="primary-button"
            >
              {translate(language, "adminSave")}
            </button>
          </div>
        </Panel>

        <Panel title={translate(language, "adminAffiliateLevelsTitle")} description={translate(language, "adminAffiliateLevelsDescription")}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {affiliateLevelOrder.map((level) => {
              const LevelIcon = levelIcons[level];
              const draft = levelDrafts?.[level] || { commissionRate: "0", referralBonus: "0" };
              return (
                <div key={level} className="rounded-[1.4rem] border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <LevelIcon className="h-4 w-4 text-amber-500" />
                    {translate(language, `affiliateLevel${level}` as TranslationKey)}
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-slate-500">{translate(language, "adminCommissionRate")}</label>
                  <input
                    value={draft.commissionRate}
                    onChange={(event) =>
                      setLevelDrafts((current) => ({
                        ...(current as Record<AffiliateLevel, { commissionRate: string; referralBonus: string }>),
                        [level]: { ...draft, commissionRate: event.target.value },
                      }))
                    }
                    className="field-input mt-1"
                    placeholder="%"
                  />
                  <label className="mt-3 block text-xs font-semibold text-slate-500">{translate(language, "adminReferralBonus")}</label>
                  <input
                    value={draft.referralBonus}
                    onChange={(event) =>
                      setLevelDrafts((current) => ({
                        ...(current as Record<AffiliateLevel, { commissionRate: string; referralBonus: string }>),
                        [level]: { ...draft, referralBonus: event.target.value },
                      }))
                    }
                    className="field-input mt-1"
                    placeholder={translate(language, "currency")}
                  />
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              if (!levelDrafts) {
                return;
              }
              const affiliateLevels = Object.fromEntries(
                affiliateLevelOrder.map((level) => [
                  level,
                  {
                    commissionRate: Number(levelDrafts[level].commissionRate || 0),
                    referralBonus: Number(levelDrafts[level].referralBonus || 0),
                  },
                ]),
              ) as Record<AffiliateLevel, { commissionRate: number; referralBonus: number }>;
              void adminService
                .updateSettings(token, { affiliateLevels })
                .then(loadAll)
                .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"));
            }}
            className="primary-button mt-4"
          >
            {translate(language, "adminSave")}
          </button>
        </Panel>

        <Panel title="Homepage slider ads" description="Small responsive slides for phone and desktop. Add image, title, link, priority, and active state.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <input value={bannerForm.titleAr} onChange={(event) => setBannerForm({ ...bannerForm, titleAr: event.target.value })} className="field-input" placeholder="Arabic title" />
            <input value={bannerForm.titleFr} onChange={(event) => setBannerForm({ ...bannerForm, titleFr: event.target.value })} className="field-input" placeholder="French title" />
            <input value={bannerForm.titleEn} onChange={(event) => setBannerForm({ ...bannerForm, titleEn: event.target.value })} className="field-input" placeholder="English title" />
            <ImageUploadField token={token} value={bannerForm.image} onChange={(url) => setBannerForm({ ...bannerForm, image: url })} />
            <input value={bannerForm.link} onChange={(event) => setBannerForm({ ...bannerForm, link: event.target.value })} className="field-input" placeholder="/products?category=phones" />
            <input value={bannerForm.priority} onChange={(event) => setBannerForm({ ...bannerForm, priority: event.target.value })} className="field-input" placeholder="Priority" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() =>
                void adminService
                  .createBanner(token, {
                    title: {
                      ar: bannerForm.titleAr,
                      fr: bannerForm.titleFr,
                      en: bannerForm.titleEn,
                    },
                    image: bannerForm.image,
                    link: bannerForm.link || undefined,
                    priority: Number(bannerForm.priority || 0),
                    isActive: bannerForm.isActive,
                  })
                  .then(async () => {
                    setBannerForm(defaultBannerForm);
                    await loadAll();
                  })
              }
              className="primary-button"
            >
              Add slide
            </button>
          </div>
        </Panel>

        <div className="grid gap-4">
          {banners.map((banner) => {
            const draft = bannerDrafts[banner._id];
            if (!draft) {
              return null;
            }

            return (
              <div key={banner._id} className="surface-card p-5">
                <div className="grid gap-5 xl:grid-cols-[220px_1fr]">
                  <img src={draft.image} alt="" className="h-36 w-full rounded-[1.4rem] object-cover" />
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <input value={draft.titleAr} onChange={(event) => setBannerDrafts((current) => ({ ...current, [banner._id]: { ...draft, titleAr: event.target.value } }))} className="field-input" placeholder="Arabic title" />
                      <input value={draft.titleFr} onChange={(event) => setBannerDrafts((current) => ({ ...current, [banner._id]: { ...draft, titleFr: event.target.value } }))} className="field-input" placeholder="French title" />
                      <input value={draft.titleEn} onChange={(event) => setBannerDrafts((current) => ({ ...current, [banner._id]: { ...draft, titleEn: event.target.value } }))} className="field-input" placeholder="English title" />
                      <div className="md:col-span-2">
                        <ImageUploadField token={token} value={draft.image} onChange={(url) => setBannerDrafts((current) => ({ ...current, [banner._id]: { ...draft, image: url } }))} />
                      </div>
                      <input value={draft.link} onChange={(event) => setBannerDrafts((current) => ({ ...current, [banner._id]: { ...draft, link: event.target.value } }))} className="field-input" placeholder="Link" />
                      <input value={draft.priority} onChange={(event) => setBannerDrafts((current) => ({ ...current, [banner._id]: { ...draft, priority: event.target.value } }))} className="field-input" placeholder="Priority" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() =>
                          void adminService
                            .updateBanner(token, banner._id, {
                              title: { ar: draft.titleAr, fr: draft.titleFr, en: draft.titleEn },
                              image: draft.image,
                              link: draft.link || undefined,
                              priority: Number(draft.priority || 0),
                              isActive: draft.isActive,
                            })
                            .then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                        }
                        className="primary-button"
                      >
                        {translate(language, "adminSave")}
                      </button>
                      <button
                        onClick={() =>
                          void adminService
                            .updateBanner(token, banner._id, { isActive: !draft.isActive })
                            .then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                        }
                        className="ghost-button"
                      >
                        {draft.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => void adminService.deleteBanner(token, banner._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))}
                        className="ghost-button text-rose-600"
                      >
                        {translate(language, "adminDelete")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  const renderAdmins = () => {
    const filteredSubAdmins = subAdmins.filter((a) => {
      const q = subAdminSearch.toLowerCase();
      return !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    });
    return (
    <div className="space-y-6">
      <Panel title={translate(language, "adminAdminsTitle")} description={translate(language, "adminAdminsDescription")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input value={subAdminForm.name} onChange={(event) => setSubAdminForm({ ...subAdminForm, name: event.target.value })} className="field-input" placeholder={translate(language, "adminSubAdminName")} />
          <input type="email" value={subAdminForm.email} onChange={(event) => setSubAdminForm({ ...subAdminForm, email: event.target.value })} className="field-input" placeholder={translate(language, "adminSubAdminEmail")} />
          <input type="password" value={subAdminForm.password} onChange={(event) => setSubAdminForm({ ...subAdminForm, password: event.target.value })} className="field-input" placeholder={translate(language, "adminSubAdminPassword")} />
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-slate-700">{translate(language, "adminSubAdminPermissions")}</label>
          <div className="flex flex-wrap gap-3">
            {ADMIN_PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={subAdminForm.permissions.includes(permission)}
                  onChange={(event) =>
                    setSubAdminForm((current) => ({
                      ...current,
                      permissions: event.target.checked
                        ? [...current.permissions, permission]
                        : current.permissions.filter((item) => item !== permission),
                    }))
                  }
                />
                {translate(language, permissionLinkMap[permission].labelKey)}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() =>
              void adminService
                .createAdmin(token, subAdminForm)
                .then(async () => {
                  setSubAdminForm(defaultSubAdminForm);
                  await loadAll();
                })
                .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
            }
            className="primary-button"
          >
            {translate(language, "adminCreateSubAdmin")}
          </button>
        </div>
      </Panel>

      {subAdmins.length ? (
        <>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={subAdminSearch}
            onChange={(event) => setSubAdminSearch(event.target.value)}
            className="field-input max-w-xs"
            placeholder="بحث بالاسم أو البريد..."
          />
          <span className="text-sm text-slate-500">{filteredSubAdmins.length} مشرف</span>
        </div>
        <div className="grid gap-4">
          {filteredSubAdmins.map((subAdmin) => {
            const draft = subAdminDrafts[subAdmin._id] || { permissions: subAdmin.permissions, password: "" };
            return (
              <div key={subAdmin._id} className="surface-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{subAdmin.name}</div>
                    <div className="text-sm text-slate-500">{subAdmin.email}</div>
                  </div>
                  <StatusBadge label={subAdmin.isActive ? "ACTIVE" : "INACTIVE"} language={language} />
                </div>
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">{translate(language, "adminSubAdminPermissions")}</label>
                  <div className="flex flex-wrap gap-3">
                    {ADMIN_PERMISSIONS.map((permission) => (
                      <label key={permission} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.permissions.includes(permission)}
                          onChange={(event) =>
                            setSubAdminDrafts((current) => ({
                              ...current,
                              [subAdmin._id]: {
                                ...draft,
                                permissions: event.target.checked
                                  ? [...draft.permissions, permission]
                                  : draft.permissions.filter((item) => item !== permission),
                              },
                            }))
                          }
                        />
                        {translate(language, permissionLinkMap[permission].labelKey)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-4 max-w-sm">
                  <input
                    type="password"
                    value={draft.password}
                    onChange={(event) => setSubAdminDrafts((current) => ({ ...current, [subAdmin._id]: { ...draft, password: event.target.value } }))}
                    className="field-input"
                    placeholder={translate(language, "adminNewPasswordOptional")}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      void adminService
                        .updateAdmin(token, subAdmin._id, {
                          permissions: draft.permissions,
                          ...(draft.password ? { password: draft.password } : {}),
                        })
                        .then(loadAll)
                        .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                    }
                    className="primary-button"
                  >
                    {translate(language, "adminSave")}
                  </button>
                  <button
                    onClick={() =>
                      void adminService
                        .updateAdmin(token, subAdmin._id, { isActive: !subAdmin.isActive })
                        .then(loadAll)
                        .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
                    }
                    className="ghost-button"
                  >
                    {subAdmin.isActive ? translate(language, "adminDeactivate") : translate(language, "adminActivate")}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(translate(language, "adminConfirmDeleteSubAdmin"))) {
                        void adminService
                          .deleteAdmin(token, subAdmin._id)
                          .then(loadAll)
                          .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"));
                      }
                    }}
                    className="ghost-button text-rose-600"
                  >
                    {translate(language, "adminDelete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
      ) : (
        <EmptyState title={translate(language, "adminAdminsTitle")} description={translate(language, "adminNoSubAdmins")} />
      )}
    </div>
    );
  };

  const renderCustomers = () => {
    const filteredCustomers = customers.filter((c) => {
      const q = customerSearch.toLowerCase();
      return !q || c.phone.includes(q) || c.fullName.toLowerCase().includes(q);
    });
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="field-input min-w-[220px] flex-1 py-2 text-sm"
          />
          <span className="text-sm text-slate-400">{filteredCustomers.length} عميل</span>
        </div>
        <div className="table-wrap">
          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">لا يوجد عملاء</div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>الهاتف</th>
                  <th>الاسم</th>
                  <th>عدد الطلبات</th>
                  <th>المجموع</th>
                  <th>آخر طلب</th>
                  <th>الحالات</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.phone}>
                    <td className="font-mono text-sm">{c.phone}</td>
                    <td>{c.fullName}</td>
                    <td>{c.orderCount}</td>
                    <td>{formatCurrency(c.totalSpent)}</td>
                    <td>{formatDate(c.lastOrderDate)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {c.statuses.map((s) => (
                          <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{s}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const currentViewMeta: Record<string, { icon: typeof BarChart3; title: string; description: string }> = {
    dashboard: {
      icon: Sparkles,
      title: translate(language, "dashboard"),
      description: translate(language, "authAdminDescription"),
    },
    products: {
      icon: Package,
      title: translate(language, "products"),
      description: translate(language, "adminProductsTitle"),
    },
    categories: {
      icon: Tag,
      title: translate(language, "categories"),
      description: translate(language, "adminCategoriesTitle"),
    },
    brands: {
      icon: Building2,
      title: translate(language, "adminBrandsTitle"),
      description: translate(language, "adminBrand"),
    },
    orders: {
      icon: Phone,
      title: translate(language, "adminOrdersTitle"),
      description: translate(language, "adminOrdersDescription"),
    },
    shipping: {
      icon: MapPin,
      title: translate(language, "shippingFees"),
      description: translate(language, "checkoutShippingFeeError"),
    },
    "promo-codes": {
      icon: TicketPercent,
      title: translate(language, "promoCodes"),
      description: translate(language, "adminPromoCreateDescription"),
    },
    affiliates: {
      icon: Users,
      title: translate(language, "affiliates"),
      description: translate(language, "authAffiliateDescription"),
    },
    commissions: {
      icon: Wallet,
      title: translate(language, "commissions"),
      description: translate(language, "affiliateCommissionRule"),
    },
    withdrawals: {
      icon: Wallet,
      title: translate(language, "adminWithdrawalsTitle"),
      description: translate(language, "adminWithdrawalsDescription"),
    },
    "coupon-requests": {
      icon: Gift,
      title: translate(language, "adminCouponRequestsTitle"),
      description: translate(language, "adminCouponRequestsDescription"),
    },
    settings: {
      icon: Shield,
      title: translate(language, "settings"),
      description: translate(language, "authAdminDescription"),
    },
    admins: {
      icon: Crown,
      title: translate(language, "adminAdminsTitle"),
      description: translate(language, "adminAdminsDescription"),
    },
    analytics: {
      icon: BarChart3,
      title: translate(language, "analyticsTitle"),
      description: translate(language, "analyticsVisitorsByDay"),
    },
    customers: {
      icon: Users,
      title: "العملاء",
      description: "قاعدة بيانات العملاء مجمّعة من الطلبات",
    },
  };

  const activeViewMeta = currentViewMeta[tab] || currentViewMeta.dashboard;

  const currentView =
    tab === "products"
      ? renderProducts()
      : tab === "categories"
        ? renderCategories()
        : tab === "brands"
          ? renderBrands()
          : tab === "orders"
            ? renderOrders()
            : tab === "shipping"
              ? renderShipping()
              : tab === "promo-codes"
                ? renderPromos()
                : tab === "affiliates"
                  ? renderAffiliates()
                  : tab === "commissions"
                    ? renderCommissions()
                    : tab === "withdrawals"
                      ? renderWithdrawals()
                      : tab === "coupon-requests"
                        ? renderCouponRequests()
                        : tab === "settings"
                          ? renderSettings()
                          : tab === "admins"
                            ? renderAdmins()
                            : tab === "analytics"
                              ? renderAnalytics()
                              : tab === "customers"
                                ? renderCustomers()
                                : renderDashboard();

  return (
    <DashboardShell
      title={translate(language, "dashboard")}
      description={translate(language, "authAdminDescription")}
      links={links}
      onLogout={() => setAdminSession(null)}
    >
      <Seo title={translate(language, "dashboard")} noindex />
      <section className="admin-page-header">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300 ring-1 ring-white/12">
              <activeViewMeta.icon className="h-5 w-5" />
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">{activeViewMeta.title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">{activeViewMeta.description}</p>
            {tab === "products" && (
              <button
                type="button"
                onClick={() => {
                  setShowAddProductForm(true);
                  setEditingProductId(null);
                  setProductForm(defaultProductForm);
                  setVariantDrafts([{ ...defaultVariantDraft }]);
                  setTimeout(() => document.getElementById("product-add-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-slate-100"
              >
                + {translate(language, "adminCreate")}
              </button>
            )}
            {tab === "orders" && (
              <button
                type="button"
                onClick={exportOrdersCSV}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <BarChart3 className="h-4 w-4" /> Export CSV
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{translate(language, "orders")}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{orders.length}</div>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{translate(language, "dashboardPending")}</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {orders.filter((order) => order.status === "AWAITING_CALL_CONFIRMATION" || order.status === "PENDING_AI_CONFIRMATION").length}
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{translate(language, "products")}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{products.length}</div>
            </div>
          </div>
        </div>
      </section>
      {currentView}

      {/* Confirmation modal */}
      {confirmModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`rounded-t-3xl px-6 py-5 ${
              confirmModal.tone === "danger"
                ? "bg-rose-50 border-b border-rose-100"
                : confirmModal.tone === "warning"
                  ? "bg-amber-50 border-b border-amber-100"
                  : "bg-slate-50 border-b border-slate-100"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                  confirmModal.tone === "danger"
                    ? "bg-rose-100 text-rose-600"
                    : confirmModal.tone === "warning"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-slate-100 text-slate-600"
                }`}>
                  {confirmModal.tone === "danger"
                    ? <AlertTriangle className="h-5 w-5" />
                    : <Check className="h-5 w-5" />}
                </div>
                <h2 className="text-lg font-semibold text-slate-950">{confirmModal.title}</h2>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm leading-6 text-slate-600">{confirmModal.message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="ghost-button px-5 py-2.5 text-sm"
              >
                {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                  confirmModal.tone === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-slate-900 hover:bg-slate-700"
                }`}
              >
                {confirmModal.confirmLabel ?? (language === "ar" ? "تأكيد" : language === "fr" ? "Confirmer" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
