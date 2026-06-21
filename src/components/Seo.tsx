import { Helmet } from "react-helmet-async";
import { useApp } from "@/hooks/useApp";

export const SITE_URL = "https://visadz.store";
const FALLBACK_NAME = "VisaStore";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  path?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  keywords?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: FALLBACK_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/products?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: FALLBACK_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description: "متجر إلكتروني جزائري — هواتف، إلكترونيات، ملحقات — الدفع عند الاستلام لجميع ولايات الجزائر",
  areaServed: { "@type": "Country", name: "Algeria" },
  contactPoint: { "@type": "ContactPoint", contactType: "customer service", areaServed: "DZ", availableLanguage: ["Arabic", "French"] },
};

export function Seo({ title, description, image, path, type = "website", noindex, jsonLd, keywords, breadcrumbs }: SeoProps) {
  const { siteSettings } = useApp();
  const siteName = siteSettings?.storeName || FALLBACK_NAME;
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const canonical = path ? `${SITE_URL}${path}` : undefined;
  const ogImage = image || siteSettings?.logo || DEFAULT_IMAGE;

  const schemas: Record<string, unknown>[] = [];
  if (type === "website") {
    schemas.push({ ...WEBSITE_SCHEMA, name: siteName });
    schemas.push({ ...ORGANIZATION_SCHEMA, name: siteName });
  }
  if (breadcrumbs && breadcrumbs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    });
  }
  if (jsonLd) {
    const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    schemas.push(...arr);
  }

  return (
    <Helmet>
      <html lang="ar" dir="rtl" />
      <title>{fullTitle}</title>
      <meta name="google-site-verification" content="ewcLY-cX6iUc1Tgu978_kt9Gf7RHzJXHUud3lrhttuI" />
      {description ? <meta name="description" content={description} /> : null}
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />

      {/* Open Graph */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content={type === "product" ? "product" : type} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="ar_DZ" />
      <meta property="og:locale:alternate" content="fr_DZ" />

      {/* Twitter / X Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={ogImage} />

      {/* Geo targeting for Algeria */}
      <meta name="geo.region" content="DZ" />
      <meta name="geo.placename" content="Algeria" />
      <meta name="language" content="Arabic" />

      {schemas.length > 0 ? (
        <script type="application/ld+json">{JSON.stringify(schemas.length === 1 ? schemas[0] : schemas)}</script>
      ) : null}
    </Helmet>
  );
}
