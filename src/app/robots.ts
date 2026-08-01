import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // static export が吐く RSC ペイロード(.txt)は canonical を持たない本文複製のため
        // クロール対象から外す(レンダリングに必要な JS/CSS はブロックしない)
        disallow: ["/*.txt$", "/__next."],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
