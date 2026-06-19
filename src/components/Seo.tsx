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
}

export function Seo({ title, description, image, path, type = "website", noindex, jsonLd, keywords }: SeoProps) {
  const { siteSettings } = useApp();
  const siteName = siteSettings?.storeName || FALLBACK_NAME;
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const canonical = path ? `${SITE_URL}${path}` : undefined;
  const ogImage = image || siteSettings?.logo || DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content={type === "product" ? "product" : type} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="ar_DZ" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={ogImage} />

      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>
  );
}
