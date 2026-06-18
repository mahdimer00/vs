const ZR_BASE = "https://api.zrexpress.app/api/v1";
const headers = {
  "Content-Type": "application/json",
  "X-Tenant": process.env.ZR_EXPRESS_TENANT_ID,
  "X-Api-Key": process.env.ZR_EXPRESS_SECRET_KEY,
};

const res = await fetch(`${ZR_BASE}/parcels/labels/individual/pdf`, {
  method: "POST",
  headers,
  body: JSON.stringify({ trackingNumbers: ["51-IHW3CH8RTV-ZR"], format: "A6" }),
});

const json = await res.json();
const fileUrl = json.parcelLabelFiles?.[0]?.fileUrl;
console.log("Step 1 — fileUrl:", fileUrl ? "✅ GOT URL" : "❌ MISSING");
console.log(JSON.stringify(json, null, 2));

if (fileUrl) {
  const pdfRes = await fetch(fileUrl);
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  const magic = buf.slice(0, 4).toString();
  console.log(`\nStep 2 — PDF bytes: ${buf.length}, magic: "${magic}" (should be "%PDF")`);
  if (magic === "%PDF") {
    console.log("✅ Valid PDF! Label is working.");
  } else {
    console.log("❌ Not a valid PDF.");
  }
}
