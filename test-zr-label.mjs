/**
 * ZR Express label endpoint tester.
 * Run inside Docker: docker exec visastore-backend-1 node /app/test-zr-label.mjs
 *
 * Replace TRACKING below with a real ZR tracking number from your database.
 */
const TRACKING = process.env.TRACKING || "51-IHW3CH8RTV-ZR";
const ZR_BASE = "https://api.zrexpress.app/api/v1";
const tenant = process.env.ZR_EXPRESS_TENANT_ID;
const apiKey = process.env.ZR_EXPRESS_SECRET_KEY;

if (!tenant || !apiKey) {
  console.error("❌  ZR_EXPRESS_TENANT_ID or ZR_EXPRESS_SECRET_KEY not set");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-Tenant": tenant,
  "X-Api-Key": apiKey,
};

const endpoints = [
  { path: "/parcels/labels/individual/pdf", body: { trackingNumbers: [TRACKING], format: "A6" } },
  { path: "/parcels/stickers/pdf",          body: { trackingNumbers: [TRACKING], format: "A6" } },
  { path: "/parcels/print",                 body: { trackingNumbers: [TRACKING] } },
  { path: "/parcels/labels/bulk",           body: { trackingNumbers: [TRACKING], format: "A6" } },
];

for (const ep of endpoints) {
  try {
    const res = await fetch(`${ZR_BASE}${ep.path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(ep.body),
    });
    const ct = res.headers.get("content-type") ?? "?";
    const bodyBuf = Buffer.from(await res.arrayBuffer());

    console.log(`\n📍 ${ep.path}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Content-Type: ${ct}`);
    console.log(`   Body size: ${bodyBuf.length} bytes`);
    if (ct.includes("json") || ct.includes("text")) {
      console.log(`   Body: ${bodyBuf.toString("utf8").slice(0, 500)}`);
    } else if (bodyBuf.length > 0) {
      console.log(`   First 4 bytes: ${bodyBuf.slice(0, 4).toString("hex")} (PDF magic = 25504446)`);
      console.log(`   ✅  Looks like binary PDF!`);
    }
  } catch (err) {
    console.log(`\n📍 ${ep.path}  → ERROR: ${err.message}`);
  }
}
