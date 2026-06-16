# Security Changes Log

## VUL-001 — Admin Settings Mass Assignment / Operator Injection

**File:** `backend/src/modules/admin/admin.routes.ts`  
**Route:** `PATCH /api/admin/settings`  
**Previous risk:** Raw `req.body` passed to `findOneAndUpdate({}, req.body, ...)`. No schema validation. Attacker with admin token could inject MongoDB operators or set arbitrary document fields.  
**Fix:** Added `websiteSettingsSchema` (Zod) with allowlisted fields only. Changed update call to `{ $set: input }`.  
**Test added:** See SECURITY_TEST_PLAN.md §1  
**Compatibility:** No breaking change — only valid setting fields were ever meaningful.

---

## VUL-002 — passwordHash in API Responses

**Files:**
- `backend/src/modules/auth/auth.routes.ts` — affiliate register and login responses
- `backend/src/modules/affiliate/affiliate.routes.ts` — dashboard response
- `backend/src/modules/admin/admin.routes.ts` — all `.lean()` affiliate queries
- `backend/src/modules/orders/order.routes.ts` — `.populate("affiliate")` calls

**Previous risk:** Mongoose documents and populated lean results included `passwordHash` (bcrypt hash) in JSON responses.  
**Fix:**
- Non-lean responses: `const { passwordHash: _ph, ...safeAffiliate } = affiliate.toObject()` before serialization
- Lean queries: `.select("-passwordHash")` on `AffiliateModel` queries
- Populated queries: `.populate("affiliate", "-passwordHash")` on all joins

**Test added:** See SECURITY_TEST_PLAN.md §2  
**Compatibility:** Frontend code never used `passwordHash`; no breaking change.

---

## VUL-003 — JWT Algorithm Not Restricted

**File:** `backend/src/middleware/auth.middleware.ts`, `backend/src/utils/auth.ts`  
**Previous risk:** `jwt.verify()` without `algorithms` option allowed any declared algorithm including `none`.  
**Fix:** Added `{ algorithms: ["HS256"] }` to `jwt.verify()` and `{ algorithm: "HS256" }` to `jwt.sign()`.  
**Test added:** See SECURITY_TEST_PLAN.md §3  
**Compatibility:** No change to token format or expiry.

---

## VUL-004 — No Rate Limit on Order Creation

**File:** `backend/src/middleware/rateLimit.middleware.ts`, `backend/src/modules/orders/order.routes.ts`  
**Previous risk:** `POST /api/orders` only had the global 300/15min limit.  
**Fix:** Added `orderCreateRateLimitMiddleware` (5 per IP per hour) applied to the order creation route.  
**Test added:** See SECURITY_TEST_PLAN.md §4  
**Compatibility:** Legitimate buyers place at most 1–2 orders per session. 5/hour is well above normal usage.

---

## VUL-005 — No Rate Limit on Promo Code Validation

**File:** `backend/src/middleware/rateLimit.middleware.ts`, `backend/src/modules/promo/promo.routes.ts`  
**Previous risk:** `POST /api/promo/validate` was publicly accessible with only the global rate limit, enabling promo code enumeration.  
**Fix:** Added `promoValidateRateLimitMiddleware` (20 per IP per 15 min).  
**Test added:** See SECURITY_TEST_PLAN.md §5  
**Compatibility:** Legitimate checkout uses 1–3 promo validation calls. 20 is generous.

---

## VUL-006 — Missing HTTP Security Headers

**File:** `netlify.toml`  
**Previous risk:** Frontend served without `X-Frame-Options`, `X-Content-Type-Options`, HSTS, or `Referrer-Policy`.  
**Fix:** Added `[[headers]]` block with all standard security headers.  
**Test added:** See SECURITY_TEST_PLAN.md §6  
**Compatibility:** `X-Frame-Options: DENY` may break any intentional embedding of the site in an iframe (none exists currently). `COOP: same-origin-allow-popups` is compatible with OAuth popups if ever added.

---

## VUL-007 — ObjectId Validation Middleware

**File:** `backend/src/middleware/objectId.middleware.ts` (new file)  
**Applied to:** admin product, category, brand, banner, order, affiliate, sub-admin, promo-code routes with `:id` params  
**Previous risk:** Malformed IDs caused Mongoose CastError handled by error middleware, but could expose internal error structure.  
**Fix:** New `validateObjectId` middleware returns HTTP 400 with generic message before reaching the handler.  
**Test added:** See SECURITY_TEST_PLAN.md §7  
**Compatibility:** No valid ObjectId is rejected. Invalid strings that were previously silently failing now fail fast with a clear error.

---

## VUL-008 — express-mongo-sanitize Added

**File:** `backend/src/app.ts`, `backend/package.json`  
**Previous risk:** No defense-in-depth layer against `$`-prefixed keys in request body.  
**Fix:** `app.use(mongoSanitize())` after body parsing — strips keys beginning with `$` from `req.body`, `req.query`, `req.params` before route handlers run.  
**Test added:** Implicit — mongo-sanitize has its own test suite.  
**Compatibility:** No legitimate field in any Zod schema starts with `$`. No breaking change.
