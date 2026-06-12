import { Copy, Link2, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/hooks/useApp";
import { DashboardShell } from "@/layout/DashboardShell";
import { affiliateService } from "@/services/affiliate.service";
import type { Commission, Order } from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function AffiliateDashboardPage() {
  const location = useLocation();
  const tab = location.pathname.replace("/affiliate", "").replace(/^\//, "") || "dashboard";
  const { affiliateSession, setAffiliateSession, language, pushToast } = useApp();
  const token = affiliateSession?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<{
    affiliate: { name: string; referralCode: string; balanceApproved: number; balancePaid: number; balancePending: number };
    ordersCount: number;
    clicksCount: number;
    referralLink: string;
    promoCodes: string[];
  } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
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
    ])
      .then(([dashboardData, orderData, commissionData]) => {
        setDashboard(dashboardData);
        setOrders(orderData);
        setCommissions(commissionData);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load affiliate data");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const links = [
    { href: "/affiliate", label: translate(language, "dashboard") },
    { href: "/affiliate/orders", label: translate(language, "orders") },
    { href: "/affiliate/commissions", label: translate(language, "commissions") },
    { href: "/affiliate/withdrawals", label: translate(language, "withdrawals") },
    { href: "/affiliate/promo-codes", label: translate(language, "promoCodes") },
  ];

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

  const content = (() => {
    switch (tab) {
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
                    <div className="mt-1 text-sm text-slate-500">{commission.rate}% commission</div>
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
                  .then(() => {
                    pushToast(translate(language, "affiliateWithdrawalSuccess"), "success");
                    setWithdrawal({ amount: "", method: "RIP", accountInfo: "" });
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
              <div className="mt-4 flex flex-wrap gap-3">
                {dashboard?.promoCodes.length ? (
                  dashboard.promoCodes.map((code) => (
                    <span key={code} className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                      {code}
                    </span>
                  ))
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                [translate(language, "affiliateClicks"), String(dashboard?.clicksCount ?? 0)],
                [translate(language, "affiliateOrders"), String(dashboard?.ordersCount ?? 0)],
                [translate(language, "affiliateApproved"), formatCurrency(dashboard?.affiliate.balanceApproved ?? 0, language)],
                [translate(language, "affiliatePaid"), formatCurrency(dashboard?.affiliate.balancePaid ?? 0, language)],
              ].map(([label, value]) => (
                <div key={label} className="stat-card">
                  <div className="text-sm text-slate-500">{label}</div>
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
                <div className="mt-4 flex flex-wrap gap-3">
                  {dashboard?.promoCodes.length ? (
                    dashboard.promoCodes.map((code) => (
                      <span key={code} className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                        {code}
                      </span>
                    ))
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
