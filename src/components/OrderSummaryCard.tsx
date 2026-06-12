import { Minus, Plus, X } from "lucide-react";
import type { CartItem, Locale } from "@/types";
import { buildVariantLabel, formatCurrency, getLocalizedText } from "@/utils/format";
import { translate } from "@/utils/i18n";

export function OrderSummaryCard({
  cart,
  subtotal,
  shippingFee,
  discount,
  total,
  language,
  onUpdateQuantity,
  onRemove,
}: {
  cart: CartItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  language: Locale;
  onUpdateQuantity?: (index: number, quantity: number) => void;
  onRemove?: (index: number) => void;
}) {
  return (
    <aside className="surface-card p-6">
      <h3 className="text-lg font-semibold text-slate-900">{translate(language, "orderSummary")}</h3>
      <div className="mt-5 space-y-4">
        {cart.map((item, index) => (
          <div key={`${item.product._id}-${index}`} className="flex items-start gap-3">
            <img src={item.product.images[0]} alt="" className="h-16 w-16 rounded-[1.2rem] object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">
                {getLocalizedText(item.product.name, language)}
              </div>
              <div className="text-xs text-slate-500">{buildVariantLabel(item.variant)}</div>
              {onUpdateQuantity ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-teal-600 hover:text-teal-600 disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[1.5rem] text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                    disabled={item.quantity >= item.variant.stock}
                    className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-teal-600 hover:text-teal-600 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="ms-1 grid h-7 w-7 place-items-center rounded-full text-slate-400 transition hover:text-rose-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-400">x{item.quantity}</div>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {formatCurrency(item.quantity * item.variant.price, language)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3 border-t border-slate-200 pt-4 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>{translate(language, "subtotal")}</span>
          <span>{formatCurrency(subtotal, language)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>{translate(language, "shippingFee")}</span>
          <span>{formatCurrency(shippingFee, language)}</span>
        </div>
        <div className="flex justify-between text-emerald-700">
          <span>{translate(language, "discount")}</span>
          <span>-{formatCurrency(discount, language)}</span>
        </div>
        <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white">
          <div className="flex items-center justify-between text-base font-bold">
            <span>{translate(language, "finalTotal")}</span>
            <span>{formatCurrency(total, language)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
