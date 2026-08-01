import type { Metadata } from "next";
import Script from "next/script";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import { SITE, AUTHOR, OG_BASE, absUrl } from "@/data/site";
import { Analytics } from "@vercel/analytics/next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import JsonLd from "@/components/JsonLd";
import "./globals.css";

// フォントは next/font でセルフホスト(render-blocking な外部CSSを排除)。
// 日本語グリフは unicode-range 分割で必要なぶんだけ配信される。
// サイト内で実際に使う weight は 400/500 のみ(font-bold系は不使用)。
const shippori = Shippori_Mincho({
  weight: "500",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-shippori",
});
const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-zenkaku",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.tagline}｜${SITE.name}`,
    // ページ側は固有タイトルだけ書けばよい(付け忘れ=重複タイトルを防ぐ)
    template: `%s｜${SITE.name}`,
  },
  description: SITE.description,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  openGraph: {
    ...OG_BASE,
    title: `${SITE.tagline}｜${SITE.name}`,
    description: SITE.description,
    type: "website",
    url: SITE.url,
  },
  // Google Search Console 所有権確認(URLプレフィックス・HTMLタグ方式)。
  // ★本サイト用のプロパティを登録したら、その確認コードを設定する
  //   (他サイトのコードを流用しないこと)。未設定の間は verification を出さない。
};

// サイト全体に効かせる構造化データ。@id で各ページの Article などから参照する。
// sameAs は「同一エンティティの別URL」用なので姉妹サイトには使わず、
// シカクモンとの関係は parentOrganization で表す。
const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absUrl("/#organization"),
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    logo: { "@type": "ImageObject", url: absUrl("/icon-512.png"), width: 512, height: 512 },
    parentOrganization: {
      "@type": "Organization",
      // シカクモン本体(kashikin-site)が出力している Organization の @id と一致させ、
      // 検索エンジンに同一グループのエンティティとして解釈させる
      "@id": "https://shikakumon.com/#organization",
      name: "シカクモン",
      url: SITE.hubUrl,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": absUrl("/#author"),
    name: AUTHOR.name,
    jobTitle: AUTHOR.jobTitle,
    description: AUTHOR.description,
    url: absUrl("/about/"),
    worksFor: { "@id": absUrl("/#organization") },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absUrl("/#website"),
    name: SITE.name,
    url: SITE.url,
    inLanguage: "ja",
    publisher: { "@id": absUrl("/#organization") },
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${shippori.variable} ${zenKaku.variable}`}>
      <head>
        {/* ホスト正規化: eisei-shikaku.vercel.app への直アクセスを独自ドメインへ。
            Next.js プロジェクトでは vercel.json の redirects が適用されず、
            static export では next.config の redirects も使えないため
            クライアントサイドで行う(rel=canonical も全ページで独自ドメインを指す)。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(location.hostname==='eisei-shikaku.vercel.app'){location.replace('https://eisei.shikakumon.com'+location.pathname+location.search+location.hash)}",
          }}
        />
      </head>
      <body>
        <JsonLd data={siteJsonLd} />
        <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-9">{children}</main>
          <SiteFooter />
        </div>
        <Analytics />
        {/* GA4: @next/third-parties は gtag.js を preload して初期帯域を先取りするため、
            lazyOnload の手動読込に変更(SPA遷移のPVはGA4の拡張計測「履歴の変更」が拾う)。
            SITE.gaId が空(本番のGA4プロパティ未発行)の間はタグを一切描画しない。 */}
        {SITE.gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`}
              strategy="lazyOnload"
            />
            <Script id="ga4-init" strategy="lazyOnload">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${SITE.gaId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
