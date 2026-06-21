/**
 * Granular checkout funnel tracking.
 * Sends events to:
 *  - Microsoft Clarity (session tagging)
 *  - Our own backend analytics
 *  - Sentry breadcrumbs (so error reports show the last funnel step)
 */
import { clarityEvent, clarityTag, clarityUpgradePriority } from "./clarity";
import { sentryAddBreadcrumb, captureError } from "./sentry";
import { trackEvent } from "./tracking";

export type FunnelStep =
  | "phone_entered"           // valid phone typed
  | "otp_modal_opened"        // verification choice shown
  | "otp_whatsapp_chosen"     // user picked WhatsApp
  | "otp_call_chosen"         // user picked phone call
  | "otp_sent"                // OTP successfully sent
  | "otp_failed_send"         // OTP send failed (server error)
  | "otp_verified"            // OTP code correct
  | "otp_failed_verify"       // OTP wrong code
  | "otp_expired"             // OTP expired before entry
  | "otp_modal_dismissed"     // user closed modal without acting
  | "commune_selected"        // ZR commune selected
  | "delivery_type_changed"   // home/desk changed
  | "promo_applied"           // promo code accepted
  | "promo_rejected"          // promo code rejected (with reason)
  | "form_validation_error"   // client-side validation failed (with field name)
  | "order_submit_start"      // submit button clicked
  | "order_submit_success"    // order created
  | "order_submit_error";     // backend returned error

export function trackFunnelStep(step: FunnelStep, meta?: Record<string, string | number | boolean>): void {
  // Sentry breadcrumb (appears in error reports to show context)
  sentryAddBreadcrumb("checkout", step, meta);

  // Clarity event + tag
  clarityEvent(`checkout_${step}`);
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      clarityTag(k, String(v));
    }
  }

  // Upgrade session priority on important steps (ensures these sessions are recorded)
  const PRIORITY_STEPS: FunnelStep[] = [
    "otp_failed_send", "otp_failed_verify", "form_validation_error", "order_submit_error",
  ];
  if (PRIORITY_STEPS.includes(step)) {
    clarityUpgradePriority(step);
  }
}

export function trackCheckoutError(error: unknown, step: FunnelStep, meta?: Record<string, string>): void {
  const message = error instanceof Error ? error.message : String(error);
  trackFunnelStep(step, { error: message, ...meta });
  captureError(error, { step, ...meta });
  // Upgrade so we get a session recording of this error
  clarityUpgradePriority(`${step}_error`);
}

export function trackFormValidationError(field: string): void {
  trackFunnelStep("form_validation_error", { field });
}
