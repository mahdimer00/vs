import { Banknote, Clock, Copy, Link2, MousePointerClick, PackageSearch, ShoppingBag, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/hooks/useApp";
import { DashboardShell } from "@/layout/DashboardShell";
import { affiliateService } from "@/services/affiliate.service";
import { productService } from "@/services/product.service";
import type { Commission, Order, Product, PromoCode, WithdrawalRequest } from "@/types";
import { formatCurrency, formatDate, getLocalizedText } from "@/utils/format";
import { translate, translateStatus } from "@/utils/i18n";

export function AffiliateDashboardPage() {
  const location = useLocation();
  const tab = location.pathname.replace("/affiliate", "").replace(/^\//, "") || "dashboard";
  const { affiliateSession, setAffiliateSession, language, pushToast } = useApp();
  const token = affiliateSession?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<{
    affiliate: { name: string; referralCode: string; commissionRate: number; status: string; balanceApproved: number; balancePaid: number; balancePending: number };
    ordersCount: number;
    clicksCount: number;
    referralLink: string;
    promoCodes: PromoCode[];
  } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawal, setWithdrawal] = useState({ amount: "", method: "RIP", accountInfo: "" });

  useEffect(() => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    void Promise.all([
      affiliateService.getDashboard(token),
      affiliateService.getOrders(token),
      affiliateService.getCommissions(token),
      productService.getProducts(),
      affiliateService.getWithdrawals(token),
    ])
      .then(([dashboardData, orderData, commissionData, productData, withdrawalData]) => {
        setDashboard(dashboardData);
        setOrders(orderData);
        setCommissions(commissionData);
        setProducts(productData.filter((product) => product.affiliateEnabled));
        setWithdrawals(withdrawalData);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load affiliate data");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const links = [
    { href: "/affiliate", label: translate(language, "dashboard") },
    { href: "/affiliate/products", label: translate(language, "affiliateProductsTitle") },
    { href: "/affiliate/orders", label: translate(language, "orders") },
    { href: "/affiliate/commissions", label: translate(language, "commissions") },
    { href: "/affiliate/withdrawals", label: translate(language, "withdrawals") },
    { href: "/affiliate/promo-codes", label: translate(language, "promoCodes") },
  ];

  const copyProductLink = async (slug: string) => {
    const code = dashboard?.affiliate.referralCode;
    if (!code) {
      return;
    }
    const link = `${window.location.origin}/products/${slug}?ref=${code}`;
    await navigator.clipboard.writeText(link);
    pushToast(translate(language, "affiliateCopied"));
  };

  if (loading) {
    return <LoadingState label={translate(language, "loading")} />;
  }

  if (error) {
    return (
      <DashboardShell
        title={translate(language, "affiliateDashboardTitle")}
        description={translate(language, "affiliateOverviewDescription")}
        links={links}
        onLogout={() => setAffiliateSession(null)}
      >
        <EmptyState title={translate(language, "affiliateDashboardTitle")} description={error} />
      </DashboardShell>
    );
  }

  const copyReferral = async () => {
    if (!dashboard?.referralLink) {
      return;
    }
    await navigator.clipboard.writeText(dashboard.referralLink);
    pushToast(translate(language, "affiliateCopied"));
  };

  const copyPromoCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    pushToast(translate(language, "affiliateCopied"));
  };

  const renderPromoCodeCard = (promo: PromoCode) => {
    const isExpired = Boolean(promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now());
    const isExhausted = Boolean(promo.usageLimit && promo.usedCount >= promo.usageLimit);
    const isLive = promo.isActive && !isExpired && !isExhausted;
    const discountLabel =
      promo.type === "PERCENTAGE"
        ? `${promo.value}%`
        : promo.type === "FIXED"
          ? formatCurrency(promo.value, language)
          : translate(language, "freeShipping");

    return (
      <div key={promo._id} className="muted-card flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => void copyPromoCode(promo.code)} className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700">
            <Copy className="h-3.5 w-3.5" />
            {promo.code}
          </button>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {translate(language, isLive ? "enabled" : "disabled")}
          </span>
        </div>
        <div className="text-sm text-slate-600">{discountLabel} {translate(language, "affiliateDiscount")}</div>
        <div className="text-xs text-slate-500">
          {translate(language, "adminPromoUsageLimit")}: {promo.usedCount}{promo.usageLimit ? ` / ${promo.usageLimit}` : ` (${translate(language, "adminPromoUnlimited")})`}
        </div>
        {promo.expiresAt ? (
          <div className={`text-xs ${isExpired ? "text-rose-600" : "text-slate-500"}`}>
            {translate(language, "adminPromoExpiry")}: {formatDate(promo.expiresAt, language)}
          </div>
        ) : null}
      </div>
    );
  };

  const content = (() => {
    switch (tab) {
      case "products":
        return (
          <div className="space-y-6">
            <div className="surface-card flex items-start gap-4 p-6">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-950 text-white">
                <PackageSearch className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateProductsTitle")}</h2>
                <p className="mt-1 text-sm leading-7 text-slate-500">{translate(language, "affiliateProductsDescription")}</p>
              </div>
            </div>
            {products.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <div key={product._id} className="surface-card flex flex-col gap-4 p-5">
                    <div className="flex items-start gap-4">
                      <img
                        src={product.images[0]}
                        alt={getLocalizedText(product.name, language)}
                        className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                      />
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-semibold text-slate-950">{getLocalizedText(product.name, language)}</div>
                        <div className="mt-1 text-sm text-slate-500">{formatCurrency(product.discountPrice ?? product.basePrice, language)}</div>
                        <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          {product.commissionType === "PERCENTAGE"
                            ? `${product.commissionValue}% ${translate(language, "affiliateCommission")}`
                            : `${formatCurrency(product.commissionValue, language)} ${translate(language, "affiliateCommission")}`}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => void copyProductLink(product.slug)} className="ghost-button justify-center gap-2">
                      <Copy className="h-4 w-4" />
                      {translate(language, "affiliateCopyProductLink")}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title={translate(language, "affiliateProductsTitle")} description={translate(language, "affiliateNoProducts")} />
            )}
          </div>
        );
      case "orders":
        return orders.length ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order._id} className="surface-card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{order.orderNumber}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {order.items.map((item) => item.productName.en).join(", ")}
                    </div>
                    <div className="mt-3 text-sm text-slate-500">{formatDate(order.createdAt, language)}</div>
                  </div>
                  <div className="space-y-2">
                    <StatusBadge label={order.status} language={language} />
                    <div className="text-lg font-semibold text-slate-950">{formatCurrency(order.total, language)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={translate(language, "affiliateOrdersTitle")} description={translate(language, "affiliateNoOrders")} />
        );
      case "commissions":
        return commissions.length ? (
          <div className="space-y-4">
            {commissions.map((commission) => (
              <div key={commission._id} className="surface-card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{formatCurrency(commission.amount, language)}</div>
                    <div className="mt-1 text-sm text-slate-500">{commission.rate}% {translate(language, "affiliateCommission")}</div>
                  </div>
                  <StatusBadge label={commission.status} language={language} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={translate(language, "affiliateCommissionsTitle")} description={translate(language, "affiliateNoCommissions")} />
        );
      case "withdrawals":
        return (
          <div className="space-y-6">
          <div className="surface-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateWithdrawalsTitle")}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{translate(language, "affiliateWithdrawalDescription")}</p>
            <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
              {translate(language, "affiliateCommissionRule")}
              <br />
              {translate(language, "affiliateCancelledRule")}
            </div>
            <div className="mt-2 text-sm font-semibold text-amber-700">{translate(language, "affiliateMinimumWithdrawal")}</div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <input value={withdrawal.amount} onChange={(event) => setWithdrawal({ ...withdrawal, amount: event.target.value })} className="field-input" placeholder={translate(language, "affiliateAmount")} />
              <select value={withdrawal.method} onChange={(event) => setWithdrawal({ ...withdrawal, method: event.target.value })} className="field-select">
                <option value="RIP">{translate(language, "affiliateMethodRip")}</option>
                <option value="CARDLESS_ID_PIN">{translate(language, "affiliateMethodCardless")}</option>
              </select>
              <input
                value={withdrawal.accountInfo}
                onChange={(event) => setWithdrawal({ ...withdrawal, accountInfo: event.target.value })}
                className="field-input"
                placeholder={translate(language, withdrawal.method === "RIP" ? "affiliateAccountInfoRipHint" : "affiliateAccountInfoCardlessHint")}
              />
            </div>
            <button
              onClick={() => {
                if (Number(withdrawal.amount) < 500) {
                  pushToast(translate(language, "affiliateMinimumWithdrawal"), "error");
                  return;
                }

                void affiliateService
                  .requestWithdrawal(token, { amount: Number(withdrawal.amount), method: withdrawal.method, accountInfo: withdrawal.accountInfo })
                  .then(async () => {
                    pushToast(translate(language, "affiliateWithdrawalSuccess"), "success");
                    setWithdrawal({ amount: "", method: "RIP", accountInfo: "" });
                    setWithdrawals(await affiliateService.getWithdrawals(token));
                  })
                  .catch((requestError) => {
                    const message = requestError instanceof Error ? requestError.message : translate(language, "affiliateWithdrawalError");
                    pushToast(message, "error");
                  });
              }}
              className="primary-button mt-4"
            >
              {translate(language, "affiliateRequestWithdrawal")}
            </button>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateWithdrawalHistoryTitle")}</h2>
            {withdrawals.length ? (
              <div className="mt-4 space-y-3">
                {withdrawals.map((item) => (
                  <div key={item._id} className="muted-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{formatCurrency(item.amount, language)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.method === "RIP" ? translate(language, "affiliateMethodRip") : translate(language, "affiliateMethodCardless")} · {formatDate(item.createdAt, language)}
                      </div>
                    </div>
                    <StatusBadge label={item.status} language={language} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{translate(language, "affiliateNoWithdrawals")}</p>
            )}
          </div>
          </div>
        );
      case "promo-codes":
        return (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateReferralLink")}</h2>
                  <p className="mt-2 text-sm text-slate-600">{dashboard?.affiliate.referralCode}</p>
                </div>
                <button onClick={() => void copyReferral()} className="ghost-button gap-2">
                  <Copy className="h-4 w-4" />
                  {translate(language, "affiliateCopy")}
                </button>
              </div>
              <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-700 break-all">
                {dashboard?.referralLink}
              </div>
            </div>
            <div className="surface-card p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <WalletCards className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliatePromoCardTitle")}</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {dashboard?.promoCodes.length ? (
                  dashboard.promoCodes.map((promo) => renderPromoCodeCard(promo))
                ) : (
                  <div className="text-sm text-slate-500">{translate(language, "affiliateNoPromoCodes")}</div>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            <div className="surface-card-dark flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10">
                  <Sparkles className="h-7 w-7 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{translate(language, "affiliateDashboardTitle")}</div>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {translate(language, "affiliateWelcomeBack")} {dashboard?.affiliate.name}
                  </h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                  {dashboard?.affiliate.commissionRate}% {translate(language, "affiliateCommission")}
                </span>
                <span className="rounded-full bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-300">
                  {translateStatus(language, dashboard?.affiliate.status ?? "")}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: translate(language, "affiliateClicks"), value: String(dashboard?.clicksCount ?? 0), icon: MousePointerClick },
                { label: translate(language, "affiliateOrders"), value: String(dashboard?.ordersCount ?? 0), icon: ShoppingBag },
                { label: translate(language, "affiliateApproved"), value: formatCurrency(dashboard?.affiliate.balanceApproved ?? 0, language), icon: Banknote },
                { label: translate(language, "affiliatePending"), value: formatCurrency(dashboard?.affiliate.balancePending ?? 0, language), icon: Clock },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="stat-card">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="surface-card p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateReferralLink")}</h2>
                    <p className="mt-1 text-sm text-slate-500">{translate(language, "affiliateOverviewDescription")}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-700 break-all">
                  {dashboard?.referralLink}
                </div>
                <button onClick={() => void copyReferral()} className="ghost-button mt-4 gap-2">
                  <Copy className="h-4 w-4" />
                  {translate(language, "affiliateCopy")}
                </button>
              </div>

              <div className="surface-card p-6">
                <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliatePromoCardTitle")}</h2>
                <div className="mt-4 grid gap-3">
                  {dashboard?.promoCodes.length ? (
                    dashboard.promoCodes.map((promo) => renderPromoCodeCard(promo))
                  ) : (
                    <div className="text-sm text-slate-500">{translate(language, "affiliateNoPromoCodes")}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
    }
  })();

  return (
    <DashboardShell
      title={translate(language, "affiliateDashboardTitle")}
      description={translate(language, "affiliateOverviewDescription")}
      links={links}
      onLogout={() => setAffiliateSession(null)}
    >
      {content}
    </DashboardShell>
  );
}
