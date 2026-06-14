import {
  AlertTriangle,
  Award,
  BellRing,
  Building2,
  Check,
  Crown,
  Facebook,
  Gift,
  Instagram,
  Link2,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  PackageX,
  Phone,
  Shield,
  Sparkles,
  Store,
  TicketPercent,
  Users,
  Wallet,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { ApiError } from "@/services/apiClient";
import { adminService } from "@/services/admin.service";
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

const levelIcons: Record<AffiliateLevel, typeof Medal> = {
  BRONZE: Medal,
  SILVER: Award,
  GOLD: Crown,
  PLATINUM: Sparkles,
};

const affiliateLevelOrder: AffiliateLevel[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

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
  dashboard: { href: "/admin", labelKey: "dashboard" },
  products: { href: "/admin/products", labelKey: "products" },
  categories: { href: "/admin/categories", labelKey: "categories" },
  brands: { href: "/admin/brands", labelKey: "brands" },
  orders: { href: "/admin/orders", labelKey: "orders" },
  shipping: { href: "/admin/shipping", labelKey: "shippingFees" },
  "promo-codes": { href: "/admin/promo-codes", labelKey: "promoCodes" },
  affiliates: { href: "/admin/affiliates", labelKey: "affiliates" },
  commissions: { href: "/admin/commissions", labelKey: "commissions" },
  withdrawals: { href: "/admin/withdrawals", labelKey: "adminWithdrawalsTitle" },
  "coupon-requests": { href: "/admin/coupon-requests", labelKey: "adminCouponRequestsTitle" },
  settings: { href: "/admin/settings", labelKey: "settings" },
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
    <section className="surface-card p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminDashboardPage() {
  const location = useLocation();
  const tab = location.pathname.replace("/admin", "").replace(/^\//, "") || "dashboard";
  const { adminSession, setAdminSession, language, pushToast } = useApp();
  const token = adminSession?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [settings, setSettings] = useState<WebsiteSetting | null>(null);
  const [couponRequests, setCouponRequests] = useState<CouponRequest[]>([]);
  const [notifications, setNotifications] = useState<AdminNotifications | null>(null);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);

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
  });
  const [subAdminForm, setSubAdminForm] = useState<SubAdminFormState>(defaultSubAdminForm);
  const [subAdminDrafts, setSubAdminDrafts] = useState<Record<string, { permissions: AdminPermission[]; password: string }>>({});

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
    links.push({ href: "/admin/admins", label: translate(language, "adminAdminsTitle"), badge: undefined });
  }

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
        safe(adminService.getOrders(token), []),
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
      setOrders(orderData);
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
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const wilayaLabel =
        typeof order.customer.wilaya === "string"
          ? order.customer.wilaya
          : language === "ar"
            ? order.customer.wilaya.name.ar
            : language === "fr"
              ? order.customer.wilaya.name.fr
              : order.customer.wilaya.name.en;

      return (
        (orderFilters.status === "all" || order.status === orderFilters.status) &&
        (orderFilters.wilaya === "all" || wilayaLabel === orderFilters.wilaya) &&
        (!orderFilters.phone || order.customer.phone.includes(orderFilters.phone)) &&
        (!orderFilters.date || order.createdAt.slice(0, 10) >= orderFilters.date)
      );
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
            href: "/admin/affiliates",
          }
        : null,
      notifications && notifications.pendingWithdrawals > 0
        ? {
            key: "withdrawals",
            icon: Wallet,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            label: translate(language, "adminAlertWithdrawalsPending").replace("{count}", String(notifications.pendingWithdrawals)),
            href: "/admin/withdrawals",
          }
        : null,
      notifications && notifications.pendingCouponRequests > 0
        ? {
            key: "coupons",
            icon: Gift,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            label: translate(language, "adminAlertCouponRequestsPending").replace("{count}", String(notifications.pendingCouponRequests)),
            href: "/admin/coupon-requests",
          }
        : null,
      actionableOrders.length > 0
        ? {
            key: "orders",
            icon: BellRing,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
            label: translate(language, "adminAlertOrdersPending").replace("{count}", String(actionableOrders.length)),
            href: "/admin/orders",
          }
        : null,
      stats.lowStockProducts.length > 0
        ? {
            key: "lowstock",
            icon: PackageX,
            tone: "border-rose-200 bg-rose-50 text-rose-800",
            label: translate(language, "adminAlertLowStock").replace("{count}", String(stats.lowStockProducts.length)),
            href: "/admin/products",
          }
        : null,
      expiringPromos.length > 0
        ? {
            key: "promos",
            icon: TicketPercent,
            tone: "border-sky-200 bg-sky-50 text-sky-800",
            label: translate(language, "adminAlertPromosExpiring").replace("{count}", String(expiringPromos.length)),
            href: "/admin/promo-codes",
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

          <div className="md:col-span-2 xl:col-span-4 space-y-3 rounded-2xl border border-slate-200 p-4">
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

          <div className="md:col-span-2 xl:col-span-4 space-y-3 rounded-2xl border border-slate-200 p-4">
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

          <div className="md:col-span-2 xl:col-span-4 space-y-3 rounded-2xl border border-slate-200 p-4">
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

          <div className="md:col-span-2 xl:col-span-4 space-y-3 rounded-2xl border border-slate-200 p-4">
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

      <div className="table-wrap">
        <table className="table-base">
          <thead>
            <tr>
              <th>{translate(language, "products")}</th>
              <th>{translate(language, "adminBrand")}</th>
              <th>{translate(language, "adminBasePrice")}</th>
              <th>{translate(language, "productStock")}</th>
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
                  <div className="flex items-center gap-3">
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
              <div key={category._id} className="surface-card space-y-3 p-5">
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
            <div key={category._id} className="surface-card p-5">
              {category.image ? (
                <img src={category.image} alt="" className="mb-3 h-24 w-full rounded-[1rem] object-cover" />
              ) : null}
              <div className="text-lg font-semibold text-slate-950">{getLocalizedText(category.name, language)}</div>
              <div className="mt-1 text-sm text-slate-500">{category.slug}</div>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => setEditingCategoryId(category._id)} className="text-sm font-semibold text-teal-700">
                  {translate(language, "adminEdit")}
                </button>
                <button onClick={() => void adminService.deleteCategory(token, category._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="text-sm font-semibold text-rose-600">
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
              <div key={brand._id} className="surface-card space-y-3 p-5">
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
            <div key={brand._id} className="surface-card p-5">
              <div className="text-lg font-semibold text-slate-950">{brand.name}</div>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={() => setEditingBrandId(brand._id)} className="text-sm font-semibold text-teal-700">
                  {translate(language, "adminEdit")}
                </button>
                <button onClick={() => void adminService.deleteBrand(token, brand._id).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="text-sm font-semibold text-rose-600">
                  {translate(language, "adminDelete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <Panel title={translate(language, "adminOrdersTitle")} description={translate(language, "adminOrdersDescription")}>
        <div className="grid gap-4 md:grid-cols-4">
          <select value={orderFilters.status} onChange={(event) => setOrderFilters((current) => ({ ...current, status: event.target.value }))} className="field-select">
            <option value="all">{translate(language, "filterAllStatuses")}</option>
            {["PENDING_AI_CONFIRMATION", "AWAITING_CALL_CONFIRMATION", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "PICKED_UP", "CANCELLED", "RETURNED", "FAILED"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={orderFilters.wilaya} onChange={(event) => setOrderFilters((current) => ({ ...current, wilaya: event.target.value }))} className="field-select">
            <option value="all">{translate(language, "filterAllWilayas")}</option>
            {[...new Set(
              orders.map((order) =>
                typeof order.customer.wilaya === "string"
                  ? order.customer.wilaya
                  : language === "ar"
                    ? order.customer.wilaya.name.ar
                    : language === "fr"
                      ? order.customer.wilaya.name.fr
                      : order.customer.wilaya.name.en,
              ),
            )].map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <input type="date" value={orderFilters.date} onChange={(event) => setOrderFilters((current) => ({ ...current, date: event.target.value }))} className="field-input" />
          <input value={orderFilters.phone} onChange={(event) => setOrderFilters((current) => ({ ...current, phone: event.target.value }))} className="field-input" placeholder={translate(language, "filterPhonePlaceholder")} />
        </div>
      </Panel>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order._id} className="surface-card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div>
                  <div className="text-sm uppercase tracking-[0.24em] text-slate-400">{order.orderNumber}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{order.customer.fullName}</div>
                  <div className="mt-1 text-sm text-slate-500">{order.customer.phone}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="muted-card px-4 py-3 text-sm">
                    <div className="text-slate-500">{translate(language, "wilaya")}</div>
                    <div className="mt-1 font-semibold text-slate-950">
                      {typeof order.customer.wilaya === "string"
                        ? order.customer.wilaya
                        : language === "ar"
                          ? order.customer.wilaya.name.ar
                          : language === "fr"
                            ? order.customer.wilaya.name.fr
                            : order.customer.wilaya.name.en}
                    </div>
                  </div>
                  <div className="muted-card px-4 py-3 text-sm">
                    <div className="text-slate-500">{translate(language, "adminOrderTotal")}</div>
                    <div className="mt-1 font-semibold text-slate-950">{formatCurrency(order.total, language)}</div>
                  </div>
                  <div className="muted-card px-4 py-3 text-sm">
                    <div className="text-slate-500">{translate(language, "adminOrderCreated")}</div>
                    <div className="mt-1 font-semibold text-slate-950">{formatDate(order.createdAt, language)}</div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  {order.items.map((item) => `${item.productName.en} (${item.variantLabel}) x${item.quantity}`).join(", ")}
                </div>
              </div>
              <div className="w-full max-w-xs space-y-3">
                <StatusBadge label={order.status} language={language} />
                <select value={order.status} onChange={(event) => void adminService.updateOrderStatus(token, order._id, event.target.value).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="field-select">
                  {["PENDING_AI_CONFIRMATION", "AWAITING_CALL_CONFIRMATION", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "PICKED_UP", "CANCELLED", "RETURNED", "FAILED"].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (window.confirm(translate(language, "adminConfirmDeleteOrder"))) {
                      void adminService
                        .deleteOrder(token, order._id)
                        .then(loadAll)
                        .catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"));
                    }
                  }}
                  className="w-full text-sm font-semibold text-rose-600"
                >
                  {translate(language, "adminDelete")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {promos.map((promo) => {
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

  const renderAffiliates = () => (
    <div className="grid gap-4 xl:grid-cols-2">
      {affiliates.map((affiliate) => {
        const draft = affiliateDrafts[affiliate._id];
        const LevelIcon = levelIcons[draft?.level || affiliate.level || "BRONZE"];
        const referrer = typeof affiliate.referredBy === "string" ? null : affiliate.referredBy;
        return (
          <div key={affiliate._id} className={`surface-card p-6 ${affiliate.status === "PENDING" ? "ring-2 ring-amber-300" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-semibold text-slate-950">{affiliate.name}</div>
              <div className="flex items-center gap-2">
                {affiliate.status === "PENDING" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    <BellRing className="h-3.5 w-3.5" />
                    {translate(language, "adminWaitingApproval")}
                  </span>
                ) : null}
                <StatusBadge label={affiliate.status} language={language} />
              </div>
            </div>
            <div className="mt-2 grid gap-1 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                {affiliate.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                {affiliate.phone}
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0" />
                {affiliate.referralCode}
              </div>
              {referrer ? (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0" />
                  {translate(language, "adminReferredBy")}: {referrer.name}
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                value={draft?.status || affiliate.status}
                onChange={(event) =>
                  setAffiliateDrafts((current) => ({
                    ...current,
                    [affiliate._id]: {
                      status: event.target.value as Affiliate["status"],
                      commissionRate: current[affiliate._id]?.commissionRate || String(affiliate.commissionRate),
                      level: current[affiliate._id]?.level || affiliate.level || "BRONZE",
                    },
                  }))
                }
                className="field-select"
              >
                {["PENDING", "ACTIVE", "BLOCKED"].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <input
                value={draft?.commissionRate || ""}
                onChange={(event) =>
                  setAffiliateDrafts((current) => ({
                    ...current,
                    [affiliate._id]: {
                      status: current[affiliate._id]?.status || affiliate.status,
                      commissionRate: event.target.value,
                      level: current[affiliate._id]?.level || affiliate.level || "BRONZE",
                    },
                  }))
                }
                className="field-input"
                placeholder="%"
              />
              <select
                value={draft?.level || affiliate.level || "BRONZE"}
                onChange={(event) =>
                  setAffiliateDrafts((current) => ({
                    ...current,
                    [affiliate._id]: {
                      status: current[affiliate._id]?.status || affiliate.status,
                      commissionRate: current[affiliate._id]?.commissionRate || String(affiliate.commissionRate),
                      level: event.target.value as AffiliateLevel,
                    },
                  }))
                }
                className="field-select"
              >
                {affiliateLevelOrder.map((level) => (
                  <option key={level} value={level}>
                    {translate(language, `affiliateLevel${level}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <LevelIcon className="h-3.5 w-3.5 text-amber-500" />
              {translate(language, `affiliateLevel${draft?.level || affiliate.level || "BRONZE"}` as TranslationKey)}
            </div>
            <button
              onClick={() =>
                void adminService
                  .updateAffiliate(token, affiliate._id, {
                    status: draft?.status || affiliate.status,
                    commissionRate: Number(draft?.commissionRate || affiliate.commissionRate),
                    level: draft?.level || affiliate.level || "BRONZE",
                  })
                  .then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))
              }
              className="primary-button mt-4"
            >
              {translate(language, "adminSave")}
            </button>
          </div>
        );
      })}
    </div>
  );

  const renderCommissions = () => (
    <div className="grid gap-4 xl:grid-cols-2">
      {commissions.map((commission) => {
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
  );

  const renderWithdrawals = () => (
    <div className="space-y-4">
      <Panel title={translate(language, "adminWithdrawalsTitle")} description={translate(language, "adminWithdrawalsDescription")}>
        {withdrawals.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {withdrawals.map((withdrawal) => {
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

  const renderCouponRequests = () => (
    <div className="space-y-4">
      <Panel title={translate(language, "adminCouponRequestsTitle")} description={translate(language, "adminCouponRequestsDescription")}>
        {couponRequests.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {couponRequests.map((request) => {
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
            <button onClick={() => void adminService.updateSettings(token, settings).then(loadAll).catch((error: unknown) => pushToast(error instanceof ApiError ? error.message : translate(language, "adminActionError"), "error"))} className="primary-button">
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

  const renderAdmins = () => (
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
        <div className="grid gap-4">
          {subAdmins.map((subAdmin) => {
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
      ) : (
        <EmptyState title={translate(language, "adminAdminsTitle")} description={translate(language, "adminNoSubAdmins")} />
      )}
    </div>
  );

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
                            : renderDashboard();

  return (
    <DashboardShell
      title={translate(language, "dashboard")}
      description={translate(language, "authAdminDescription")}
      links={links}
      onLogout={() => setAdminSession(null)}
    >
      <Seo title={translate(language, "dashboard")} noindex />
      {currentView}
    </DashboardShell>
  );
}
