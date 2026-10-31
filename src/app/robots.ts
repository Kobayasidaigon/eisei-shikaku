import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        // llms.txt(AI検索向けサイト概要)と IndexNow キーは .txt 除外より優先して許可。
        // 今のキーは f57ad98a…(scripts/indexnow-ping.mjs の KEY・public/ のキーファイルと一致)。旧キー c91787… も残す。
        allow: ["/", "/llms.txt", "/f57ad98a989b48989e4b0a887481b31f.txt", "/c91787eb780ae215b000ded4d9b8bac6.txt"],
        // static export が吐く RSC ペイロード(.txt)は canonical を持たない本文複製のため
        // クロール対象から外す(レンダリングに必要な JS/CSS はブロックしない)
        disallow: ["/*.txt$", "/__next."],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
