import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Moshi2Gate from "@/components/Moshi2Gate";
import Moshi2Sample from "@/components/Moshi2Sample";
import JsonLd from "@/components/JsonLd";
import { SITE, OG_BASE, absUrl } from "@/data/site";
import { moshi2CertIds, moshi2ProductOf } from "@/data/products";
import { certById, type CertId } from "@/data/questions";

// 販売中の資格だけ商品ページを静的生成する。
// このページ自体に有料の問題データは含まれない(受験画面は購入者判定を通した
// API から届く)ので、通常どおり静的生成のままで検索にも載る。
export function generateStaticParams() {
  return moshi2CertIds().map((certId) => ({ certId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certId: string }>;
}): Promise<Metadata> {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  const p = moshi2ProductOf(certId);
  if (!cert || !p) return {};

  const title = `${cert.name} 模擬試験 第2回【${p.questionCount}問・${p.timeLimitMin}分】`;
  const description = `${cert.fullName}の模擬試験 第2回。第1回とは完全に別問題で、本試験と同じ${p.questionCount}問・${p.timeLimitMin}分・合格基準${p.passLabel.replace(/（.*/, "")}。自動採点・分野別の弱点分析・全問の解説に加え、A4に組んだ印刷用の紙面(PDF保存可)つき。買い切り¥${p.priceJpy.toLocaleString()}・登録不要。`;
  const url = `/${cert.id}/moshi2/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OG_BASE, title, description, type: "website", url },
  };
}

export default async function Moshi2Page({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  const p = moshi2ProductOf(certId);
  if (!cert || !p) notFound();

  const url = absUrl(`/${cert.id}/moshi2/`);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ホーム", item: SITE.url },
        { "@type": "ListItem", position: 2, name: `${cert.name} 練習問題`, item: absUrl(`/${cert.id}/`) },
        { "@type": "ListItem", position: 3, name: "模擬試験 第2回", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: p.description,
      url,
      brand: { "@type": "Brand", name: SITE.name },
      offers: {
        "@type": "Offer",
        price: String(p.priceJpy),
        priceCurrency: "JPY",
        availability: "https://schema.org/InStock",
        url,
      },
    },
  ];

  // この商品ページは印刷対象ではない。Ctrl+P されても紙に出るのは
  // Moshi2Gate の print-only な案内一行だけになるよう、周辺は print-hide にしてある。
  return (
    <div className="fade-up">
      <JsonLd data={jsonLd} />

      {/* パンくず */}
      <nav className="print-hide text-[12px] text-ink-faint mb-4 flex flex-wrap gap-1">
        <Link href="/" className="hover:text-ink-soft underline underline-offset-2">
          ホーム
        </Link>
        <span>/</span>
        <Link href={`/${cert.id}/`} className="hover:text-ink-soft underline underline-offset-2">
          {cert.name} 練習問題
        </Link>
        <span>/</span>
        <span className="text-ink-soft">模擬試験 第2回</span>
      </nav>

      {/* 見出し */}
      <div className="print-hide mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[27px] font-medium text-ink leading-snug tracking-tight">
          {cert.name} 模擬試験 第2回
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          第1回とは完全に別問題の、2回目の実力測定です。仕様は第1回と同じ
          {p.questionCount}問・{p.timeLimitMin}分なので、
          <Link href={`/${cert.id}/moshi/`} className="underline underline-offset-2 hover:text-ink">
            無料の第1回
          </Link>
          と同じ条件で伸びを比べられます。
        </p>
      </div>

      {/* 試験仕様 */}
      <div className="print-hide bg-surface border border-line rounded-[10px] p-5 mb-5 text-[13px] text-ink-soft space-y-1.5 max-w-xl">
        <p>
          <span className="text-ink font-medium">出題数</span>　{p.questionCount}問({p.choiceFormat})
        </p>
        <p>
          <span className="text-ink font-medium">制限時間</span>　{p.timeLimitMin}分(時間切れで自動採点)
        </p>
        <p>
          <span className="text-ink font-medium">合格基準</span>　{p.passLabel}
        </p>
        <p>
          <span className="text-ink font-medium">紙面</span>　問題・解答用紙・解説を A4
          に組んだ印刷用ページつき(PDF保存可)
        </p>
        <p>
          <span className="text-ink font-medium">受験料</span>　¥{p.priceJpy.toLocaleString()}
          (買い切り・登録不要)
        </p>
      </div>

      <Moshi2Sample certId={cert.id} />

      <Moshi2Gate certId={cert.id} />

      <p className="print-hide text-[12px] text-ink-faint mt-8 max-w-xl leading-relaxed">
        ※{p.specNote}
        本模試は当サイトのオリジナル問題で構成しており、実際の試験問題の転載ではありません。
        合否判定はあくまで学習の目安です。受験料・受験資格・試験日程などは変更されることがあるため、
        必ず実施団体の公式情報をご確認ください。
      </p>
    </div>
  );
}
