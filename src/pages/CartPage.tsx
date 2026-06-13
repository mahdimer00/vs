import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";
import { useApp } from "@/hooks/useApp";
import { buildVariantLabel, formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function CartPage() {
  const { cart, language, removeFromCart, updateQuantity } = useApp();
  const subtotal = cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <EmptyState
        title={translate(language, "emptyCart")}
        description={translate(language, "cartDescription")}
        action={
          <Link to="/products" className="primary-button">
            {translate(language, "heroPrimary")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface-card p-6 md:p-8">
        <h1 className="font-serif text-2xl font-semibold text-slate-950 sm:text-3xl md:text-4xl">{translate(language, "cartTitle")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{translate(language, "cartDescription")}</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {cart.map((item, index) => (
            <div key={`${item.product._id}-${index}`} className="surface-card flex flex-col gap-4 p-5 md:flex-row">
              <img src={item.product.images[0]} alt="" className="h-28 w-full rounded-[1.5rem] bg-white object-contain p-2 md:w-28" />
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
          <OrderSummaryCard
            cart={cart}
            subtotal={subtotal}
            shippingFee={0}
            discount={0}
            total={subtotal}
            language={language}
          />
          <Link to="/checkout" className="secondary-button flex w-full justify-center py-4">
            {translate(language, "cartContinue")}
          </Link>
        </div>
      </div>
    </div>
  );
}
