import { Award, Banknote, Clock, Copy, Crown, Gift, KeyRound, Link2, Medal, MousePointerClick, PackageSearch, Phone, Settings, ShoppingBag, Sparkles, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Seo } from "@/components/Seo";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/hooks/useApp";
import { DashboardShell } from "@/layout/DashboardShell";
import { affiliateService } from "@/services/affiliate.service";
import { productService } from "@/services/product.service";
import type { Affiliate, Commission, CouponRequest, Order, Product, PromoCode, WithdrawalRequest } from "@/types";
import { ApiError } from "@/services/apiClient";
import { formatCurrency, formatDate, getLocalizedText } from "@/utils/format";
import { translate, translateStatus, type TranslationKey } from "@/utils/i18n";

const levelIcons: Record<string, typeof Medal> = {
  BRONZE: Medal,
  SILVER: Award,
  GOLD: Crown,
  PLATINUM: Sparkles,
};

export function AffiliateDashboardPage() {
  const location = useLocation();
  const tab = location.pathname.replace("/affiliate", "").replace(/^\//, "") || "dashboard";
  const { affiliateSession, setAffiliateSession, language, pushToast } = useApp();
  const token = affiliateSession?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<{
    affiliate: { name: string; referralCode: string; commissionRate: number; status: string; level: string; balanceApproved: number; balancePaid: number; balancePending: number; phone?: string };
    ordersCount: number;
    clicksCount: number;
    teamCount: number;
    referralBonusAmount: number;
    referralLink: string;
    inviteLink: string;
    promoCodes: PromoCode[];
  } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawal, setWithdrawal] = useState({ amount: "", method: "RIP", accountInfo: "" });
  const [team, setTeam] = useState<Affiliate[]>([]);
  const [couponRequests, setCouponRequests] = useState<CouponRequest[]>([]);
  const [couponForm, setCouponForm] = useState({ type: "PERCENTAGE", value: "", desiredCode: "", reason: "" });
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", currentPassword: "", newPassword: "" });
  const [profileSaving, setProfileSaving] = useState(false);

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
      affiliateService.getTeam(token),
      affiliateService.getCouponRequests(token),
    ])
      .then(([dashboardData, orderData, commissionData, productData, withdrawalData, teamData, couponRequestData]) => {
        setDashboard(dashboardData);
        setOrders(orderData);
        setCommissions(commissionData);
        setProducts(productData.filter((product) => product.affiliateEnabled));
        setWithdrawals(withdrawalData);
        setTeam(teamData);
        setCouponRequests(couponRequestData);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load affiliate data");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const reloadCouponRequests = () => {
    void affiliateService.getCouponRequests(token).then(setCouponRequests);
  };

  const links = [
    { href: "/affiliate", label: translate(language, "dashboard") },
    { href: "/affiliate/products", label: translate(language, "affiliateProductsTitle") },
    { href: "/affiliate/orders", label: translate(language, "orders") },
    { href: "/affiliate/commissions", label: translate(language, "commissions") },
    { href: "/affiliate/withdrawals", label: translate(language, "withdrawals") },
    { href: "/affiliate/promo-codes", label: translate(language, "promoCodes") },
    { href: "/affiliate/coupons", label: translate(language, "affiliateCouponRequestsTitle") },
    { href: "/affiliate/team", label: translate(language, "affiliateTeamTitle") },
    { href: "/affiliate/profile", label: translate(language, "affiliateProfile") },
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

  const copyInviteLink = async () => {
    if (!dashboard?.inviteLink) {
      return;
    }
    await navigator.clipboard.writeText(dashboard.inviteLink);
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
                        className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1"
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
      case "orders": {
        const commissionByOrder = new Map(
          commissions
            .filter((c) => c.order && typeof c.order !== "string")
            .map((c) => [String((c.order as { _id: string })._id), c]),
        );
        return orders.length ? (
          <div className="space-y-4">
            {orders.map((order) => {
              const comm = commissionByOrder.get(order._id);
              return (
                <div key={order._id} className="surface-card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-950">{order.orderNumber}</div>
                      <div className="mt-0.5 truncate text-sm text-slate-500">
                        {order.items.map((item) => item.productName.en).join(", ")}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{formatDate(order.createdAt, language)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge label={order.status} language={language} />
                      <div className="text-sm font-semibold text-slate-900">{formatCurrency(order.total, language)}</div>
                      {comm ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                          comm.status === "APPROVED" || comm.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          <Banknote className="h-3 w-3" />
                          {formatCurrency(comm.amount, language)} {translate(language, "affiliateCommission")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title={translate(language, "affiliateOrdersTitle")} description={translate(language, "affiliateNoOrders")} />
        );
      }
      case "commissions":
        return commissions.length ? (
          <div className="space-y-4">
            {commissions.map((commission) => (
              <div key={commission._id} className="surface-card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{formatCurrency(commission.amount, language)}</div>
                    {commission.type === "REFERRAL_BONUS" ? (
                      <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        <Gift className="h-3.5 w-3.5" />
                        {translate(language, "affiliateReferralBonus")}
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-slate-500">{commission.rate}% {translate(language, "affiliateCommission")}</div>
                    )}
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
            <div className="mt-2 text-sm font-semibold text-amber-700">
              {translate(language, withdrawal.method === "CARDLESS_ID_PIN" ? "affiliateMinimumWithdrawalCardless" : "affiliateMinimumWithdrawal")}
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div>
                <input value={withdrawal.amount} onChange={(event) => setWithdrawal({ ...withdrawal, amount: event.target.value })} className="field-input" placeholder={translate(language, "affiliateAmount")} />
                <div className="mt-1.5 text-xs text-slate-500">
                  {translate(language, "affiliateAvailableBalance")}: <span className="font-semibold text-slate-700">{formatCurrency(dashboard?.affiliate.balanceApproved ?? 0, language)}</span>
                </div>
              </div>
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
                const minimum = withdrawal.method === "CARDLESS_ID_PIN" ? 2000 : 500;
                if (Number(withdrawal.amount) < minimum) {
                  pushToast(translate(language, withdrawal.method === "CARDLESS_ID_PIN" ? "affiliateMinimumWithdrawalCardless" : "affiliateMinimumWithdrawal"), "error");
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
                  <div key={item._id} className="muted-card px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{formatCurrency(item.amount, language)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.method === "RIP" ? translate(language, "affiliateMethodRip") : translate(language, "affiliateMethodCardless")} · {formatDate(item.createdAt, language)}
                        </div>
                      </div>
                      <StatusBadge label={item.status} language={language} />
                    </div>
                    {item.voucherCode && item.voucherPin ? (
                      <div className="mt-3 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">{translate(language, "affiliateVoucherTitle")}</div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">{translate(language, "affiliateVoucherCode")}: </span>
                            <span className="font-mono font-bold text-slate-950">{item.voucherCode}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{translate(language, "affiliateVoucherPin")}: </span>
                            <span className="font-mono font-bold text-slate-950">{item.voucherPin}</span>
                          </div>
                        </div>
                        {item.voucherExpiresAt ? (
                          <div className="mt-2 text-xs text-amber-700">
                            {translate(language, "affiliateVoucherExpires")} {formatDate(item.voucherExpiresAt, language)}
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs leading-6 text-amber-800">{translate(language, "affiliateVoucherHint")}</p>
                      </div>
                    ) : null}
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
                <div className="flex gap-2">
                  <button onClick={() => void copyReferral()} className="ghost-button gap-2">
                    <Copy className="h-4 w-4" />
                    {translate(language, "affiliateCopy")}
                  </button>
                  {dashboard?.referralLink ? (
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent((language === "ar" ? "🛍️ تسوق عبر رابطي الخاص:\n" : "🛍️ Shop via my link:\n") + dashboard.referralLink)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ghost-button gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.305A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 0 1-4.031-1.102l-.29-.17-2.951.773.789-2.876-.19-.3A7.959 7.959 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>
                      واتساب
                    </a>
                  ) : null}
                </div>
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
      case "team":
        return (
          <div className="space-y-6">
            <div className="surface-card p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateTeamTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-500">{translate(language, "affiliateTeamDescription")}</p>
                </div>
              </div>
              <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-700 break-all">
                {dashboard?.inviteLink}
              </div>
              <button onClick={() => void copyInviteLink()} className="ghost-button mt-4 gap-2">
                <Copy className="h-4 w-4" />
                {translate(language, "affiliateCopy")}
              </button>
              {dashboard && dashboard.referralBonusAmount > 0 ? (
                <div className="mt-4 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <Gift className="mb-1 h-4 w-4" /> {translate(language, "affiliateReferralBonusHint").replace("{amount}", formatCurrency(dashboard.referralBonusAmount, language))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="stat-card">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Users className="h-4 w-4" />
                  {translate(language, "affiliateTeamMembers")}
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-950">{dashboard?.teamCount ?? 0}</div>
              </div>
            </div>

            {team.length ? (
              <div className="space-y-3">
                {team.map((member) => (
                  <div key={member._id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">{member.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{member.referralCode} · {formatDate(member.createdAt, language)}</div>
                    </div>
                    <StatusBadge label={member.status} language={language} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title={translate(language, "affiliateTeamTitle")} description={translate(language, "affiliateNoTeam")} />
            )}
          </div>
        );
      case "coupons":
        return (
          <div className="space-y-6">
            <div className="surface-card p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateCouponRequestsTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-500">{translate(language, "affiliateCouponRequestsDescription")}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <select value={couponForm.type} onChange={(event) => setCouponForm({ ...couponForm, type: event.target.value })} className="field-select">
                  <option value="PERCENTAGE">{translate(language, "adminCommissionTypePercentage")}</option>
                  <option value="FIXED">{translate(language, "adminCommissionTypeFixed")}</option>
                  <option value="FREE_SHIPPING">{translate(language, "freeShipping")}</option>
                </select>
                {couponForm.type !== "FREE_SHIPPING" ? (
                  <input value={couponForm.value} onChange={(event) => setCouponForm({ ...couponForm, value: event.target.value })} className="field-input" placeholder={translate(language, "adminCommissionValue")} />
                ) : null}
                <input value={couponForm.desiredCode} onChange={(event) => setCouponForm({ ...couponForm, desiredCode: event.target.value.toUpperCase() })} className="field-input uppercase" placeholder={translate(language, "affiliateDesiredCode")} />
                <textarea value={couponForm.reason} onChange={(event) => setCouponForm({ ...couponForm, reason: event.target.value })} className="field-input md:col-span-2" rows={3} placeholder={translate(language, "affiliateCouponReason")} />
              </div>
              <button
                onClick={() => {
                  if (couponForm.type !== "FREE_SHIPPING" && !couponForm.value) {
                    pushToast(translate(language, "adminActionError"), "error");
                    return;
                  }
                  if (!couponForm.reason.trim()) {
                    pushToast(translate(language, "adminActionError"), "error");
                    return;
                  }
                  void affiliateService
                    .requestCoupon(token, {
                      type: couponForm.type,
                      value: couponForm.type === "FREE_SHIPPING" ? 0 : Number(couponForm.value),
                      desiredCode: couponForm.desiredCode.trim() || undefined,
                      reason: couponForm.reason.trim(),
                    })
                    .then(() => {
                      pushToast(translate(language, "affiliateCouponRequestSuccess"), "success");
                      setCouponForm({ type: "PERCENTAGE", value: "", desiredCode: "", reason: "" });
                      reloadCouponRequests();
                    })
                    .catch((requestError: unknown) => pushToast(requestError instanceof ApiError ? requestError.message : translate(language, "adminActionError"), "error"));
                }}
                className="primary-button mt-4"
              >
                {translate(language, "affiliateRequestCoupon")}
              </button>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-xl font-semibold text-slate-950">{translate(language, "affiliateCouponHistoryTitle")}</h2>
              {couponRequests.length ? (
                <div className="mt-4 space-y-3">
                  {couponRequests.map((request) => (
                    <div key={request._id} className="muted-card px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">
                            {request.type === "FREE_SHIPPING"
                              ? translate(language, "freeShipping")
                              : request.type === "PERCENTAGE"
                                ? `${request.value}%`
                                : formatCurrency(request.value, language)}
                            {request.desiredCode ? ` · ${request.desiredCode}` : ""}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{request.reason}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatDate(request.createdAt, language)}</div>
                        </div>
                        <StatusBadge label={request.status} language={language} />
                      </div>
                      {request.promoCode && typeof request.promoCode !== "string" ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <Gift className="h-3.5 w-3.5" />
                          {request.promoCode.code}
                        </div>
                      ) : null}
                      {request.adminNote ? <p className="mt-2 text-xs leading-6 text-slate-500">{request.adminNote}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{translate(language, "affiliateNoCouponRequests")}</p>
              )}
            </div>
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6">
            <div className="surface-card p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {language === "ar" ? "الملف الشخصي" : language === "fr" ? "Mon profil" : "My Profile"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {language === "ar" ? "تعديل بياناتك الشخصية وكلمة المرور" : language === "fr" ? "Modifier vos informations et mot de passe" : "Update your personal info and password"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    {language === "ar" ? "الاسم الكامل" : language === "fr" ? "Nom complet" : "Full name"}
                  </label>
                  <div className="relative">
                    <input
                      value={profileForm.name}
                      onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                      placeholder={dashboard?.affiliate.name}
                      className="field-input w-full ps-10"
                    />
                    <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Users className="h-4 w-4" />
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    {language === "ar" ? "رقم الهاتف" : language === "fr" ? "Téléphone" : "Phone"}
                  </label>
                  <div className="relative">
                    <input
                      dir="ltr"
                      inputMode="tel"
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })}
                      placeholder={dashboard?.affiliate.phone ?? "05xxxxxxxx"}
                      className="field-input w-full ps-10"
                    />
                    <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Phone className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-6">
                <h3 className="text-base font-semibold text-slate-950">
                  {language === "ar" ? "تغيير كلمة المرور" : language === "fr" ? "Changer le mot de passe" : "Change password"}
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      {language === "ar" ? "كلمة المرور الحالية" : language === "fr" ? "Mot de passe actuel" : "Current password"}
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={profileForm.currentPassword}
                        onChange={(event) => setProfileForm({ ...profileForm, currentPassword: event.target.value })}
                        className="field-input w-full ps-10"
                        autoComplete="current-password"
                      />
                      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <KeyRound className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      {language === "ar" ? "كلمة المرور الجديدة" : language === "fr" ? "Nouveau mot de passe" : "New password"}
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(event) => setProfileForm({ ...profileForm, newPassword: event.target.value })}
                        className="field-input w-full ps-10"
                        autoComplete="new-password"
                      />
                      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <KeyRound className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                disabled={profileSaving}
                onClick={() => {
                  if (!profileForm.name.trim() && !profileForm.phone && !profileForm.newPassword) {
                    pushToast(language === "ar" ? "لم تقم بتغيير أي شيء" : "Nothing to update", "error");
                    return;
                  }
                  setProfileSaving(true);
                  void affiliateService
                    .updateProfile(token, {
                      name: profileForm.name.trim() || undefined,
                      phone: profileForm.phone || undefined,
                      currentPassword: profileForm.currentPassword || undefined,
                      newPassword: profileForm.newPassword || undefined,
                    })
                    .then(() => {
                      pushToast(language === "ar" ? "تم حفظ التغييرات بنجاح" : "Changes saved", "success");
                      setProfileForm({ name: "", phone: "", currentPassword: "", newPassword: "" });
                    })
                    .catch((err: unknown) => {
                      pushToast(err instanceof Error ? err.message : language === "ar" ? "حدث خطأ" : "Error", "error");
                    })
                    .finally(() => setProfileSaving(false));
                }}
                className="primary-button mt-6 px-8"
              >
                {profileSaving
                  ? (language === "ar" ? "جارٍ الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ التغييرات" : language === "fr" ? "Enregistrer" : "Save changes")}
              </button>
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
                {dashboard?.affiliate.level ? (
                  (() => {
                    const LevelIcon = levelIcons[dashboard.affiliate.level] ?? Medal;
                    return (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                        <LevelIcon className="h-4 w-4 text-amber-300" />
                        {translate(language, `affiliateLevel${dashboard.affiliate.level}` as TranslationKey)}
                      </span>
                    );
                  })()
                ) : null}
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                  {dashboard?.affiliate.commissionRate}% {translate(language, "affiliateCommission")}
                </span>
                <span className="rounded-full bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-300">
                  {translateStatus(language, dashboard?.affiliate.status ?? "")}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="stat-card">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MousePointerClick className="h-4 w-4" />
                  {translate(language, "affiliateClicks")}
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-950">{dashboard?.clicksCount ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <ShoppingBag className="h-4 w-4" />
                  {translate(language, "affiliateOrders")}
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-950">{dashboard?.ordersCount ?? 0}</div>
              </div>
              {/* DZD approved balance card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white shadow-lg">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-white/5" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm text-emerald-100">
                    <Banknote className="h-4 w-4" />
                    {translate(language, "affiliateApproved")}
                  </div>
                  <div className="mt-3 text-3xl font-bold tracking-tight">
                    {(dashboard?.affiliate.balanceApproved ?? 0).toLocaleString("ar-DZ")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-emerald-200">دج</div>
                </div>
              </div>
              {/* DZD pending balance card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-white/5" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm text-amber-100">
                    <Clock className="h-4 w-4" />
                    {translate(language, "affiliatePending")}
                  </div>
                  <div className="mt-3 text-3xl font-bold tracking-tight">
                    {(dashboard?.affiliate.balancePending ?? 0).toLocaleString("ar-DZ")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-amber-200">دج</div>
                </div>
              </div>
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => void copyReferral()} className="ghost-button gap-2">
                    <Copy className="h-4 w-4" />
                    {translate(language, "affiliateCopy")}
                  </button>
                  {dashboard?.referralLink ? (
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent((language === "ar" ? "🛍️ تسوق عبر رابطي:\n" : "🛍️ Shop via my referral link:\n") + dashboard.referralLink)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ghost-button gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.305A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 0 1-4.031-1.102l-.29-.17-2.951.773.789-2.876-.19-.3A7.959 7.959 0 0 1 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>
                      {language === "ar" ? "مشاركة واتساب" : "Share on WhatsApp"}
                    </a>
                  ) : null}
                </div>
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
      <Seo title={translate(language, "affiliateDashboardTitle")} noindex />
      {content}
    </DashboardShell>
  );
}
