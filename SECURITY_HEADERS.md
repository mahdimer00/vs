# Security Headers — VisaStore

## Frontend (Netlify — netlify.toml)

| Header | Value | Reason |
|--------|-------|--------|
| `X-Content-Type-Options` | `nosniff` | Prevents browsers from MIME-sniffing responses, blocking certain XSS vectors where a response is interpreted as executable script |
| `X-Frame-Options` | `DENY` | Prevents the site from being embedded in an iframe, blocking clickjacking attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer header to origin-only for cross-site requests, protecting page URLs from leaking to third parties (e.g. Meta Pixel) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables browser features the app does not use, reducing attack surface from malicious third-party scripts |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS for 1 year on all subdomains; prevents SSL stripping attacks |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Isolates the browsing context from cross-origin opener access while allowing `window.open()` for payment or OAuth popups |

### Not configured: Content-Security-Policy
CSP is omitted because the Meta Pixel requires inline script execution and loads third-party scripts from `connect.facebook.net`. A strict CSP that blocks `unsafe-inline` would break the pixel. A permissive CSP that allows pixel domains provides limited security benefit. This should be revisited if the pixel integration is moved to server-side only.

---

## Backend API (Helmet — express)

The backend uses `helmet()` which sets the following headers on all API responses:

| Header | Value set by Helmet | Reason |
|--------|---------------------|--------|
| `X-Content-Type-Options` | `nosniff` | Same as above |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents iframe embedding of API responses |
| `X-XSS-Protection` | `0` (modern browsers) | The `X-XSS-Protection` header is deprecated and disabled by Helmet per modern best practice |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | HSTS for API domain |
| `X-Permitted-Cross-Domain-Policies` | `none` | Prevents Flash/PDF cross-domain data loading |
| `Cross-Origin-Resource-Policy` | `cross-origin` | Set explicitly to allow the React frontend (different origin) to load uploaded images from `/uploads` |

---

## CORS Policy (backend/src/config/cors.ts)

Origin allowlist is loaded from environment variables `FRONTEND_URL` and `BACKEND_URL`.

Production values:
- `https://visadz.store` (frontend)
- `http://backend:4000` (internal Docker network)

`null` origin and arbitrary reflected origins are rejected. Credentials are enabled (`credentials: true`) only for the allowlisted origins.
