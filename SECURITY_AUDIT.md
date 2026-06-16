# Security Audit Report — VisaStore
**Date:** 2026-06-17  
**Branch:** `security-hardening`  
**Auditor:** Claude Sonnet 4.6 (AI Security Review)  
**Target:** https://visadz.store

---

## Executive Summary

The visastore application is a well-structured Node.js/Express + React e-commerce platform with JWT authentication. The scanner-reported NoSQL injection findings at `/products` and `/admin` were partially confirmed: the primary confirmed vulnerability was **mass assignment with no schema validation** on the `PATCH /admin/settings` endpoint, which allowed arbitrary MongoDB operators to be injected in the update document. Six additional vulnerabilities were identified and remediated.

No active exploitation was attempted. All fixes were applied as code changes on the `security-hardening` branch.

---

## Architecture Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript + Tailwind — hosted on Netlify |
| Backend | Node.js + Express.js + TypeScript — Docker on OVH VPS |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (HS256) — Bearer token in Authorization header |
| File uploads | multer — allowlisted MIME types, randomized filenames |
| Rate limiting | express-rate-limit |
| Input validation | Zod schemas on most routes |

---

## Scope

- Frontend React application (Netlify)
- Backend Express API (VPS at 51.38.177.166)
- Admin dashboard routes
- Authentication and authorization
- Database queries
- File upload endpoint
- Environment variables and deployment config

---

## Methodology

- Static analysis of all backend route files
- Review of all Mongoose queries for injection patterns
- Review of JWT handling, algorithm enforcement, and password handling
- Review of CORS, rate limiting, and HTTP headers
- Dependency audit via `npm audit`
- TypeScript compilation verification

---

## Confirmed Vulnerabilities

### VUL-001 — Admin Settings: No Schema Validation (Mass Assignment + Operator Injection)
**Severity:** High  
**Location:** `backend/src/modules/admin/admin.routes.ts` — `PATCH /api/admin/settings`  
**Root cause:** `findOneAndUpdate({}, req.body, { new: true, upsert: true })` passed the raw request body directly to MongoDB. An authenticated admin (or attacker with a compromised admin token) could inject MongoDB update operators such as `$currentDate`, `$unset`, or `$inc` to corrupt the settings document, or set arbitrary fields not defined in the schema.  
**Fix:** Added strict Zod schema (`websiteSettingsSchema`) with an explicit allowlist of every permitted field. Changed the MongoDB call to `{ $set: input }` so only validated fields can reach the database.  
**Status:** ✅ Fixed and tested

### VUL-002 — passwordHash Returned in API Responses
**Severity:** High  
**Affected endpoints:**
- `POST /api/auth/affiliate/register` — returned full Mongoose document including `passwordHash`
- `POST /api/auth/affiliate/login` — returned full Mongoose document including `passwordHash`
- `GET /api/affiliate/dashboard` — returned full Mongoose document including `passwordHash`
- All admin queries using `.populate("affiliate").lean()` — lean bypasses Mongoose transforms  
**Root cause:** Mongoose document was serialized directly to JSON with no field exclusion. The `passwordHash` field (bcrypt hash) was sent to any caller of these endpoints.  
**Fix:** All non-lean document responses now use destructuring (`const { passwordHash: _ph, ...safeAffiliate } = affiliate.toObject()`). All `.lean()` queries that involve affiliates now use `.select("-passwordHash")` or `.populate("affiliate", "-passwordHash")`.  
**Status:** ✅ Fixed and tested

### VUL-003 — JWT Algorithm Not Restricted
**Severity:** Medium  
**Location:** `backend/src/middleware/auth.middleware.ts`  
**Root cause:** `jwt.verify(token, secret)` without an `algorithms` option accepts any algorithm the token header declares, including `none`. This enables algorithm confusion attacks where an attacker could craft a token with `alg: none` or switch from HS to RS if the secret is ever replaced with a public key.  
**Fix:** Added `{ algorithms: ["HS256"] }` to `jwt.verify()`. Also added `{ algorithm: "HS256" }` to `jwt.sign()` for explicit consistency.  
**Status:** ✅ Fixed and tested

### VUL-004 — No Rate Limiting on Order Creation
**Severity:** Medium  
**Location:** `POST /api/orders`  
**Root cause:** Only the global 300/15min rate limit applied. An attacker could submit hundreds of fake COD orders with valid customer data, flooding the admin dashboard and exhausting product stock.  
**Fix:** Added `orderCreateRateLimitMiddleware` — 5 orders per IP per hour.  
**Status:** ✅ Fixed and tested

### VUL-005 — No Rate Limiting on Promo Code Validation
**Severity:** Medium  
**Location:** `POST /api/promo/validate`  
**Root cause:** Public unauthenticated endpoint with only global rate limit. Promo codes are alphanumeric uppercase strings, which are enumerable by brute force (e.g. iterating BASE000–BASE999).  
**Fix:** Added `promoValidateRateLimitMiddleware` — 20 attempts per IP per 15 minutes.  
**Status:** ✅ Fixed and tested

### VUL-006 — Missing HTTP Security Headers (Frontend)
**Severity:** Medium  
**Location:** `netlify.toml`  
**Root cause:** No security headers were configured for the Netlify-hosted frontend. Browsers loaded the React SPA without `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy`.  
**Fix:** Added response headers for all paths:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`
**Status:** ✅ Fixed and tested

### VUL-007 — No ObjectId Format Validation
**Severity:** Low  
**Location:** Multiple admin routes using `req.params.id` with `findById`  
**Root cause:** Invalid ObjectIds (e.g. `../`, `null`, random strings) caused Mongoose CastError, which the error middleware caught but which could leak internal framework information in edge cases.  
**Fix:** Added `validateObjectId` middleware applied to all mutating admin routes with `:id` parameters.  
**Status:** ✅ Fixed and tested

### VUL-008 — No MongoDB Operator Sanitization (Defense-in-Depth)
**Severity:** Low  
**Location:** All routes  
**Root cause:** No defense-in-depth layer to strip `$`-prefixed keys from request body/query/params before Zod parsing.  
**Fix:** Added `express-mongo-sanitize` middleware after JSON body parsing in `app.ts`.  
**Status:** ✅ Fixed and tested

---

## Scanner Findings — False Positive Analysis

**Scanner finding:** "Possible NoSQL Injection at `/products`"  
**Analysis:** The `GET /api/products` handler uses hardcoded query `{ status: { $ne: "ARCHIVED" } }` with no user input in the filter. The `GET /api/products/:slug` uses `req.params.slug` (always a string from URL path, cannot be an object) in `findOne({ slug: req.params.slug })`. These are **not vulnerable** to NoSQL injection.  
**Status:** False positive on the `/products` path. The `/admin` finding was a true positive (VUL-001).

---

## Remaining Risks

| Risk | Notes |
|------|-------|
| Order tracking PII | `GET /orders/track/:orderNumber` and `GET /orders/track-by-phone/:phone` return full customer PII to unauthenticated callers. This is intentional (COD tracking) but means any guessed order number leaks customer name/phone/address. Consider requiring the phone number to match the order for tracking-by-order-number. |
| Affiliate click inflation | `POST /affiliate/track-click/:referralCode` stores `req.ip` which trusts the first proxy hop via `trust proxy: 1`. An attacker could inflate click counts with spoofed IPs if behind additional proxies. |
| AI prompt injection | `/ai/product-question` concatenates user message directly into the Ollama prompt with no sanitization. This allows prompt injection to override system instructions. Low severity since the AI only has read access to product data. |
| JWT token invalidation | Issued tokens cannot be revoked (no blocklist). A compromised token is valid until its 7-day expiry. |
| bcrypt cost factor | Current cost factor is 10. Consider 12 for stronger protection at the cost of slightly slower logins. |

---

## Manual Actions Required

1. **Rotate any credentials that have been in the `.env` on a shared repo** — confirm the production `.env` values were never committed to git (verified: `.env` is in `.gitignore` and not tracked).
2. **Add Cloudflare or nginx-level rate limiting** in front of the VPS for the `/api/orders` and `/api/auth` endpoints as a second layer.
3. **Order tracking PII** — consider requiring phone + order number combination for order lookup by order number.
4. **Review the Telegram bot token** — messages include customer PII (name, phone, address). Ensure the Telegram bot chat is private and access-controlled.

---

## Dependencies

`npm audit` in `backend/` showed no critical or high severity vulnerabilities in direct dependencies. The `express-mongo-sanitize` package was added as a new dependency.
