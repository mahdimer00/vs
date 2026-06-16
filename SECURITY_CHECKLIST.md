# Security Checklist — VisaStore

Status codes:  
`[x]` Fixed and tested  
`[ ]` Not fixed  
`[!]` Needs manual action  
`[?]` Could not verify

---

## Authentication
- [x] Passwords hashed with bcrypt (cost factor 10)
- [x] Plaintext passwords never stored or logged
- [x] Login responses do not reveal account existence (returns generic "Invalid credentials")
- [x] Login endpoints rate-limited (10 attempts per 15 min)
- [x] JWT signatures verified server-side
- [x] JWT algorithm explicitly restricted to HS256
- [x] Expired and malformed tokens rejected
- [ ] Refresh token rotation not implemented (tokens are 7-day single-issue)
- [!] JWT token invalidation requires token blocklist — not implemented; compromised tokens are valid until expiry
- [x] Cookies not used for auth (Bearer token in header)
- [x] Default admin credentials guarded by production check in env.ts
- [!] MFA not implemented for admin accounts

## Authorization
- [x] Unauthenticated requests return 401
- [x] Unauthorized requests return 403
- [x] Admin role loaded from JWT (signed server-side), not from request body
- [x] Users cannot modify their own role
- [x] Affiliate users can only access their own orders, commissions, withdrawals
- [x] Admin roles checked via `roleMiddleware` and `permissionMiddleware`
- [x] Sub-admin permissions enforced server-side
- [x] SUPER_ADMIN-only routes guarded by `roleMiddleware(["SUPER_ADMIN"])`

## Input Validation
- [x] All auth routes validate input with Zod
- [x] All admin mutations validate input with Zod
- [x] Order creation fully validated with Zod
- [x] Admin settings now validated with Zod schema (fixed VUL-001)
- [x] ObjectId parameters validated before reaching DB (fixed VUL-007)
- [x] Phone number format validated (Algerian regex)
- [x] Request body size limited to 2MB
- [x] MongoDB operator keys stripped by express-mongo-sanitize (defense-in-depth)

## NoSQL / Injection
- [x] Admin settings update uses $set with validated input only
- [x] Auth login uses validated email/password before DB query
- [x] Product slug lookup uses URL param (always string, not injectable as object)
- [x] Order tracking uses URL params (always string)
- [x] express-mongo-sanitize installed as defense-in-depth
- [ ] AI endpoint input not sanitized against prompt injection (low risk — read-only)

## Sensitive Data
- [x] passwordHash excluded from affiliate register response
- [x] passwordHash excluded from affiliate login response
- [x] passwordHash excluded from affiliate dashboard response
- [x] passwordHash excluded from all admin lean queries via .select("-passwordHash")
- [x] passwordHash excluded from populated affiliate joins via populate("affiliate", "-passwordHash")
- [x] Sub-admin creation explicitly omits passwordHash from response
- [!] Order tracking endpoints return full customer PII (name, phone, address) to unauthenticated callers — by design for COD tracking, but high risk if order numbers are guessable

## Rate Limiting
- [x] Global rate limit: 300 req/15 min
- [x] Login rate limit: 10 req/15 min
- [x] Order creation: 5 per IP per hour (new)
- [x] Promo validation: 20 per IP per 15 min (new)
- [ ] Analytics event ingestion: only global limit
- [ ] AI product question: only global limit (could be abused to generate Ollama load)

## HTTP Security Headers
- [x] X-Content-Type-Options: nosniff (Netlify)
- [x] X-Frame-Options: DENY (Netlify)
- [x] Referrer-Policy: strict-origin-when-cross-origin (Netlify)
- [x] Strict-Transport-Security configured (Netlify)
- [x] Permissions-Policy configured (Netlify)
- [x] Cross-Origin-Opener-Policy configured (Netlify)
- [x] Helmet used for backend API headers
- [ ] Content-Security-Policy not set (complex for React SPA with Meta Pixel inline scripts)

## CORS
- [x] CORS allowlist is explicit (not wildcard)
- [x] Credentials: true with explicit origin check
- [x] Arbitrary origins rejected

## File Upload
- [x] MIME type allowlist enforced (jpeg, png, webp, avif only)
- [x] File size limit (5MB)
- [x] Random server-generated filenames
- [x] Uploads served from /uploads static path (not executable directory)
- [x] Upload endpoint requires admin auth

## Secrets / Configuration
- [x] .env files in .gitignore
- [x] .env never committed to git (verified via git ls-files)
- [x] Production guard in env.ts rejects default JWT_SECRET and passwords
- [x] Frontend environment variable (VITE_META_PIXEL_ID) is a pixel ID, not a secret
- [!] Telegram bot token stored in .env — ensure production token has minimal scopes
- [!] Meta CAPI access token stored in backend .env — verify rotation schedule

## Dependencies
- [x] No critical or high severity vulnerabilities in direct dependencies (npm audit clean)
- [x] express-mongo-sanitize added
- [ ] npm audit shows some moderate advisories in transitive dependencies — non-exploitable in this context

## Deployment
- [x] HTTPS enforced (Netlify + OVH VPS with nginx)
- [x] .env files not in git
- [?] VPS firewall configuration not directly verifiable — ensure only ports 80/443/22 are open
- [?] MongoDB not publicly exposed — relies on Docker internal network (assumed correct)
- [?] Nginx reverse proxy configuration not inspected — assumed to be standard Docker setup
