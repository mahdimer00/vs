# Security Test Plan — VisaStore
Non-destructive, reproducible tests. Run against a local or staging instance only.

---

## §1 — Admin Settings: Operator Injection and Mass Assignment

### Test 1A — MongoDB operator in settings update (should be rejected)
```bash
# Get a valid admin token first
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-admin-password"}' | jq -r .token)

# Attempt to inject MongoDB $currentDate operator
curl -s -X PATCH http://localhost:4000/api/admin/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"$currentDate":{"createdAt":true}}' | jq .

# Expected: HTTP 400 with Zod validation error
# NOT expected: HTTP 200 (would indicate injection succeeded)
```

### Test 1B — Unknown field rejected (mass assignment)
```bash
curl -s -X PATCH http://localhost:4000/api/admin/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"SUPER_ADMIN","storeName":"Legit Name"}' | jq .

# Expected: HTTP 200 with only storeName applied; no "role" field in response
```

### Test 1C — Valid settings update still works
```bash
curl -s -X PATCH http://localhost:4000/api/admin/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maintenanceMode":false,"promoCodeEnabled":true}' | jq .

# Expected: HTTP 200 with updated settings
```

---

## §2 — passwordHash Not in Responses

### Test 2A — Affiliate login must not return passwordHash
```bash
RESP=$(curl -s -X POST http://localhost:4000/api/auth/affiliate/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@affiliate.com","password":"yourpassword"}')

echo $RESP | jq 'has("affiliate") and (.affiliate | has("passwordHash"))'
# Expected output: false
```

### Test 2B — Admin affiliates list must not include passwordHash
```bash
curl -s http://localhost:4000/api/admin/affiliates \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.[0] | has("passwordHash")'
# Expected output: false
```

### Test 2C — Populated affiliate in orders must not include passwordHash
```bash
curl -s http://localhost:4000/api/admin/orders \
  -H "Authorization: Bearer $TOKEN" | \
  jq '[.[] | select(.affiliate != null) | .affiliate | has("passwordHash")] | any'
# Expected output: false
```

---

## §3 — JWT Algorithm Restriction

### Test 3A — Token with "none" algorithm must be rejected
```bash
# Craft a token with alg:none manually
# Header: {"alg":"none","typ":"JWT"}
# Payload: {"sub":"000000000000000000000001","role":"SUPER_ADMIN","email":"x@x.com","iat":9999999999}
NONE_TOKEN="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJlbWFpbCI6InhAeC5jb20iLCJpYXQiOjk5OTk5OTk5OTl9."

curl -s http://localhost:4000/api/admin/stats \
  -H "Authorization: Bearer $NONE_TOKEN" | jq .

# Expected: HTTP 401 {"message":"Unauthorized"}
# NOT expected: HTTP 200 (would indicate alg:none accepted)
```

### Test 3B — Valid HS256 token still works
```bash
curl -s http://localhost:4000/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" | jq 'has("totalOrders")'
# Expected output: true
```

---

## §4 — Order Creation Rate Limit

### Test 4A — 6th order in one hour from same IP must be rate-limited
```bash
# Send 5 valid orders (with minimal valid payload)
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:4000/api/orders \
    -H "Content-Type: application/json" \
    -d '{
      "customer":{"fullName":"Test User","phone":"0555123456","wilayaCode":"16","commune":"Alger Centre","address":"123 Test Street"},
      "items":[{"productId":"VALID_PRODUCT_ID","variantId":"VALID_VARIANT_ID","quantity":1}],
      "deliveryType":"HOME_DELIVERY"
    }' > /dev/null
done

# 6th attempt
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":{"fullName":"T","phone":"0555123456","wilayaCode":"16","commune":"X","address":"Y"},"items":[],"deliveryType":"HOME_DELIVERY"}')

echo "HTTP $STATUS"
# Expected: HTTP 429
```

---

## §5 — Promo Code Rate Limit

### Test 5A — 21st promo attempt in 15 min must be rate-limited
```bash
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:4000/api/promo/validate \
    -H "Content-Type: application/json" \
    -d '{"code":"INVALID'$i'","subtotal":10000,"productIds":[],"categoryIds":[]}' > /dev/null
done

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"INVALID21","subtotal":10000}')

echo "HTTP $STATUS"
# Expected: HTTP 429
```

---

## §6 — Security Headers

### Test 6A — Check frontend headers
```bash
curl -s -I https://visadz.store | grep -i -E "x-content-type|x-frame|referrer|strict-transport|permissions-policy|cross-origin"
# Expected: all configured headers present with correct values
```

### Test 6B — Check backend API headers via Helmet
```bash
curl -s -I http://localhost:4000/api/products | grep -i -E "x-content-type|x-frame|x-xss"
# Expected: Helmet security headers present
```

---

## §7 — ObjectId Validation

### Test 7A — Malformed ID must return 400 not 500
```bash
curl -s -X PATCH http://localhost:4000/api/admin/products/NOTANID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isFeatured":true}' | jq '{status: .message}'

# Expected: {"message": "Invalid ID format"} with HTTP 400
# NOT expected: HTTP 500 or CastError stack trace
```

### Test 7B — Path traversal attempt in ID
```bash
curl -s -X DELETE "http://localhost:4000/api/admin/products/../../../etc/passwd" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404 or 400 — never 200 or 500 with system file content
```

---

## §8 — NoSQL Injection Attempts (Defense-in-Depth)

### Test 8A — $ne injection in promo code
```bash
curl -s -X POST http://localhost:4000/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code":{"$ne":null},"subtotal":10000,"productIds":[],"categoryIds":[]}' | jq .

# Expected: HTTP 400 validation error (Zod rejects non-string code)
```

### Test 8B — $where in settings update
```bash
curl -s -X PATCH http://localhost:4000/api/admin/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"$where":"sleep(5000)"}' | jq .

# Expected: HTTP 400 with validation error immediately (no delay)
```

### Test 8C — Operator in order creation items
```bash
curl -s -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":{"fullName":"X Y","phone":"0555123456","wilayaCode":"16","commune":"Alger","address":"123 St"},"items":[{"productId":{"$ne":null},"variantId":"x","quantity":1}],"deliveryType":"HOME_DELIVERY"}' | jq .

# Expected: HTTP 400 (Zod rejects non-string productId)
```

---

## §9 — Authorization Tests

### Test 9A — Unauthenticated access to admin route must return 401
```bash
curl -s http://localhost:4000/api/admin/orders | jq .message
# Expected: "Unauthorized"
```

### Test 9B — Affiliate token cannot access admin orders
```bash
AFF_TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/affiliate/login \
  -H "Content-Type: application/json" \
  -d '{"email":"affiliate@example.com","password":"affiliatepass"}' | jq -r .token)

curl -s http://localhost:4000/api/admin/orders \
  -H "Authorization: Bearer $AFF_TOKEN" | jq .message
# Expected: "Forbidden"
```

### Test 9C — Affiliate can only see their own commissions
```bash
curl -s http://localhost:4000/api/affiliate/commissions \
  -H "Authorization: Bearer $AFF_TOKEN" | \
  jq '[.[] | .affiliate] | unique | length'
# Expected: 1 (only the authenticated affiliate's ID)
```
