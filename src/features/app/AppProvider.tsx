import { createContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/constants/storage";
import { affiliateService } from "@/services/affiliate.service";
import { settingsService } from "@/services/settings.service";
import type { AuthSession, CartItem, Locale, PendingOrderPayload, WebsiteSetting } from "@/types";
import { buildVariantLabel, getLocalizedText, isRTL } from "@/utils/format";
import { translate } from "@/utils/i18n";
import { pixelAddToCart } from "@/utils/pixel";
import { ttqAddToCart } from "@/utils/tiktok";
import { trackEvent } from "@/utils/tracking";
import { readSessionStorage, readStorage, writeSessionStorage, writeStorage } from "@/utils/storage";

type Toast = { id: number; message: string; tone?: "success" | "error" };

interface AppContextValue {
  language: Locale;
  setLanguage: (value: Locale) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  adminSession: AuthSession | null;
  setAdminSession: (session: AuthSession | null) => void;
  affiliateSession: AuthSession | null;
  setAffiliateSession: (session: AuthSession | null) => void;
  affiliateRef: string | null;
  setAffiliateRef: (value: string | null) => void;
  rememberPendingOrder: (payload: PendingOrderPayload | null) => void;
  pendingOrder: PendingOrderPayload | null;
  rememberConfirmedOrder: (payload: unknown) => void;
  confirmedOrder: unknown;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  pushToast: (message: string, tone?: "success" | "error") => void;
  dismissToast: (id: number) => void;
  toasts: Toast[];
  siteSettings: WebsiteSetting | null;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>(() => readStorage(STORAGE_KEYS.language, "ar"));
  const [cart, setCart] = useState<CartItem[]>(() => readStorage(STORAGE_KEYS.cart, []));
  const [adminSession, setAdminSessionState] = useState<AuthSession | null>(() =>
    readSessionStorage(STORAGE_KEYS.adminSession, null),
  );
  const [affiliateSession, setAffiliateSessionState] = useState<AuthSession | null>(() =>
    readSessionStorage(STORAGE_KEYS.affiliateSession, null),
  );
  const [affiliateRef, setAffiliateRefState] = useState<string | null>(() =>
    readStorage(STORAGE_KEYS.affiliateRef, null),
  );
  const [pendingOrder, setPendingOrderState] = useState<PendingOrderPayload | null>(() =>
    readSessionStorage(STORAGE_KEYS.pendingOrder, null),
  );
  const [confirmedOrder, setConfirmedOrderState] = useState<unknown>(() =>
    readSessionStorage(STORAGE_KEYS.confirmedOrder, null),
  );
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage(STORAGE_KEYS.wishlist, []));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [siteSettings, setSiteSettings] = useState<WebsiteSetting | null>(null);

  useEffect(() => {
    void settingsService
      .getSettings()
      .then((data) => setSiteSettings(data))
      .catch(() => setSiteSettings(null));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL(language) ? "rtl" : "ltr";
    writeStorage(STORAGE_KEYS.language, language);
  }, [language]);

  useEffect(() => writeStorage(STORAGE_KEYS.cart, cart), [cart]);
  useEffect(() => writeSessionStorage(STORAGE_KEYS.adminSession, adminSession), [adminSession]);
  useEffect(() => writeSessionStorage(STORAGE_KEYS.affiliateSession, affiliateSession), [affiliateSession]);
  useEffect(() => writeStorage(STORAGE_KEYS.affiliateRef, affiliateRef), [affiliateRef]);
  useEffect(() => writeSessionStorage(STORAGE_KEYS.pendingOrder, pendingOrder), [pendingOrder]);
  useEffect(() => writeSessionStorage(STORAGE_KEYS.confirmedOrder, confirmedOrder), [confirmedOrder]);
  useEffect(() => writeStorage(STORAGE_KEYS.wishlist, wishlist), [wishlist]);

  const pushToast = (message: string, tone: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const addToCart = (item: CartItem) => {
    setCart((current) => {
      const index = current.findIndex(
        (entry) =>
          entry.product._id === item.product._id &&
          buildVariantLabel(entry.variant) === buildVariantLabel(item.variant),
      );

      if (index === -1) {
        return [...current, { ...item, quantity: Math.min(item.variant.stock, item.quantity) }];
      }

      return current.map((entry, entryIndex) =>
        entryIndex === index
          ? { ...entry, quantity: Math.min(entry.variant.stock, entry.quantity + item.quantity) }
          : entry,
      );
    });

    pushToast(`${getLocalizedText(item.product.name, language)} · ${translate(language, "productAddToCart")}`);

    // Track AddToCart for Meta Pixel and internal analytics
    const productName = item.product.name.en || item.product.name.ar || item.product.name.fr;
    pixelAddToCart({ productId: item.product._id, productName, value: item.variant.price * item.quantity });
    ttqAddToCart(item.product._id, productName, item.variant.price * item.quantity);
    trackEvent({ eventType: "add_to_cart", productId: item.product._id });
  };

  const rememberPendingOrder = (payload: PendingOrderPayload | null) => setPendingOrderState(payload);
  const rememberConfirmedOrder = (payload: unknown) => setConfirmedOrderState(payload);

  const toggleWishlist = (productId: string) => {
    const exists = wishlist.includes(productId);
    setWishlist((current) =>
      exists ? current.filter((id) => id !== productId) : [...current, productId],
    );
    pushToast(translate(language, exists ? "wishlistRemoved" : "wishlistAdded"), "success");
  };

  const value = useMemo<AppContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      cart,
      addToCart,
      removeFromCart: (index) => setCart((current) => current.filter((_, currentIndex) => currentIndex !== index)),
      updateQuantity: (index, quantity) =>
        setCart((current) =>
          current.map((entry, currentIndex) =>
            currentIndex === index
              ? { ...entry, quantity: Math.max(1, Math.min(entry.variant.stock, quantity || 1)) }
              : entry,
          ),
        ),
      clearCart: () => setCart([]),
      adminSession,
      setAdminSession: setAdminSessionState,
      affiliateSession,
      setAffiliateSession: setAffiliateSessionState,
      affiliateRef,
      setAffiliateRef: (value) => {
        setAffiliateRefState(value);
        if (value) {
          void affiliateService.trackClick(value).catch(() => undefined);
        }
      },
      rememberPendingOrder,
      pendingOrder,
      rememberConfirmedOrder,
      confirmedOrder,
      wishlist,
      toggleWishlist,
      isWishlisted: (productId) => wishlist.includes(productId),
      pushToast,
      dismissToast: (id) => setToasts((current) => current.filter((toast) => toast.id !== id)),
      toasts,
      siteSettings,
    }),
    [adminSession, affiliateRef, affiliateSession, cart, confirmedOrder, language, pendingOrder, siteSettings, toasts, wishlist],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
