import { Helmet } from "react-helmet-async";

const SITE_NAME = "VisaStore";
const SITE_URL = "https://visadz.store";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  path?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function Seo({ title, description, image, path, type = "website", noindex, jsonLd }: SeoProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const canonical = path ? `${SITE_URL}${path}` : undefined;
  const ogImage = image || DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content={type === "product" ? "product" : type} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={ogImage} />

      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>
  );
}
