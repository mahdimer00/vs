import { BadgeCheck, Tag, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";
import { Seo } from "@/components/Seo";
import { useApp } from "@/hooks/useApp";
import { promoService } from "@/services/promo.service";
import { buildVariantLabel, formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function CartPage() {
  const { cart, language, removeFromCart, updateQuantity, pushToast } = useApp();
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoApplying, setPromoApplying] = useState(false);
  const subtotal = cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoApplying(true);
    try {
      const res = await promoService.validate({
        code: promoCode.trim(),
        phone: "",
        subtotal,
        productIds: cart.map((i) => i.product._id),
        categoryIds: [],
        shippingFee: 0,
      });
      setDiscount(res.discount);
      setAppliedPromo(promoCode.toUpperCase());
      pushToast(language === "ar" ? "تم تطبيق كود الخصم ✓" : "Promo applied ✓", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : translate(language, "promoRejected"), "error");
    } finally {
      setPromoApplying(false);
    }
  };

  if (cart.length === 0) {
    return (
      <>
        <Seo title={translate(language, "cartTitle")} description={translate(language, "cartDescription")} path="/cart" noindex />
        <EmptyState
          title={translate(language, "emptyCart")}
          description={translate(language, "cartDescription")}
          action={
            <Link to="/products" className="primary-button">
              {translate(language, "heroPrimary")}
            </Link>
          }
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Seo title={translate(language, "cartTitle")} description={translate(language, "cartDescription")} path="/cart" noindex />
      <section className="surface-card p-6 md:p-8">
        <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, "cartTitle")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "cartDescription")}</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {cart.map((item, index) => (
            <div key={`${item.product._id}-${index}`} className="surface-card flex flex-col gap-4 p-5 md:flex-row">
              <img
                src={item.product.images[0]}
                alt={getLocalizedText(item.product.name, language)}
                className="h-28 w-full rounded-[1.5rem] bg-white object-contain p-2 md:w-28"
              />
              <div className="flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{getLocalizedText(item.product.name, language)}</h2>
                    <p className="mt-1 text-sm text-slate-500">{buildVariantLabel(item.variant)}</p>
                    <p className="mt-3 text-lg font-bold text-slate-950">{formatCurrency(item.variant.price, language)}</p>
                  </div>
                  <button onClick={() => removeFromCart(index)} className="text-sm font-medium text-rose-600">
                    {translate(language, "cartRemove")}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <input
                    type="number"
                    min={1}
                    max={item.variant.stock}
                    value={item.quantity}
                    onChange={(event) => updateQuantity(index, Number(event.target.value))}
                    className="field-input w-28"
                  />
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                    {item.variant.stock} {translate(language, "cartAvailable")}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <OrderSummaryCard cart={cart} subtotal={subtotal} shippingFee={0} discount={discount} total={total} language={language} />

          {/* Promo code */}
          <div className="surface-card p-4">
            {appliedPromo ? (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <BadgeCheck className="h-4 w-4" />
                  {appliedPromo} — {language === "ar" ? "خصم" : "Discount"} {formatCurrency(discount, language)}
                </div>
                <button onClick={() => { setAppliedPromo(""); setPromoCode(""); setDiscount(0); }}>
                  <X className="h-4 w-4 text-emerald-600" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
                  <Tag className="h-4 w-4 shrink-0 text-slate-400" />
                  <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    placeholder={language === "ar" ? "كود الخصم" : "Promo code"} />
                </div>
                <button type="button" onClick={() => void applyPromo()} disabled={promoApplying || !promoCode.trim()}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">
                  {promoApplying ? "..." : (language === "ar" ? "تطبيق" : "Apply")}
                </button>
              </div>
            )}
          </div>

          <Link to={`/checkout${appliedPromo ? `?promo=${appliedPromo}` : ""}`} className="secondary-button flex w-full justify-center py-4">
            {translate(language, "cartContinue")}
          </Link>
        </div>
      </div>
    </div>
  );
}
