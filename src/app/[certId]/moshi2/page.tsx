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

  const title = `${cert.name} 第2回模擬試験（本番形式・全問解説・弱点診断）`;
  const description = `${cert.fullName}の模擬試験 第2回。第1回とは1問も重複しない初見の${p.questionCount}問で、本試験と同じ${p.timeLimitMin}分・合格基準${p.passLabel.replace(/（.*/, "")}の条件をもう一度通す本番前の最終確認用。全問解説・分野別の弱点診断・A4印刷用紙面つき。買い切り¥${p.priceJpy.toLocaleString()}・登録不要。`;
  const url = `/${cert.id}/moshi2/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OG_BASE, title, description, type: "website", url },
  };
}

/**
 * 【2026-09-20 改修】販売ページの構成を「仕様表」から「価値→信頼→安心→価格」の順に組み替えた。
 *   改修前は 仕様表(受験料入り)→サンプル→購入ボックス で、GA4 28日間で到達75人・
 *   平均エンゲージメント13秒・checkout 0。価格を見て、買う理由が書かれる前に離脱していた。
 *   節の順序: H1+リード / こんな方 / 含まれるもの / サンプル(#sample) / 作問方針 /
 *   価格ボックス / FAQ / 第1回への戻し口(1か所だけ)。価格ボックス以降は Moshi2Gate が描く。
 *
 *   価値の節は Moshi2Gate に `pitch` として渡す。購入済みの人にはこの節を出さず、
 *   受験画面だけを見せるため(サーバー側で描いた JSX を client component に渡している)。
 */
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

  const pitch = (
    <div className="print-hide">
      {/* 2. こんな方のための1回分 */}
      <section className="mb-6 max-w-xl">
        <h2 className="font-serif text-[17px] font-medium text-ink mb-2">こんな方のための1回分です</h2>
        <ul className="text-[13px] text-ink-soft leading-relaxed space-y-1.5 list-disc pl-5">
          <li>第1回が「あと一歩」「未達」だった → 復習のあと、別問題で伸びを確かめたい</li>
          <li>第1回が合格圏だった → 本番は初見。もう1セットで再現性を確認したい</li>
          <li>本試験まで3週間を切った → 本番形式の通し練習を残り回数分やっておきたい</li>
        </ul>
      </section>

      {/* 3. 含まれるもの(価値の高い順) */}
      <section className="mb-6 max-w-xl bg-surface border border-line rounded-[10px] p-5">
        <h2 className="font-serif text-[17px] font-medium text-ink mb-2">含まれるもの</h2>
        <ul className="text-[13px] text-ink-soft leading-relaxed space-y-1.5 list-disc pl-5">
          <li>
            <span className="text-ink">第1回と1問も重複しない新作{p.questionCount}問</span>
            (本試験と同じ形式・配点・時間: {p.choiceFormat}・{p.timeLimitMin}分・{p.passLabel})
          </li>
          <li>
            全{p.questionCount}問の解説。正解の根拠だけでなく、誤りの選択肢がなぜ誤りかまで
          </li>
          <li>分野別正答率と弱点診断。間違えた問題は練習問題の復習に自動で反映</li>
          <li>印刷用 A4 紙面(問題・解答用紙・解説、PDF 保存可)</li>
          <li>買い切り・登録不要・サブスクなし</li>
        </ul>
      </section>

      {/* 4. サンプル問題(id="sample") */}
      <Moshi2Sample certId={cert.id} />

      {/* 5. 作問方針(信頼) */}
      <section className="mb-6 max-w-xl">
        <h2 className="font-serif text-[17px] font-medium text-ink mb-2">作問方針</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          本試験の出題範囲・形式に合わせて編集部がオリジナルで作成しています。公式問題の転載ではありません。
          法改正・最新テキストに合わせて随時更新します。
          <Link href="/about/" className="underline underline-offset-2 hover:text-ink ml-1">
            運営者情報
          </Link>
        </p>
      </section>
    </div>
  );

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

      {/* 1. 見出しとリード */}
      <div className="print-hide mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[27px] font-medium text-ink leading-snug tracking-tight">
          {cert.name} 第2回模擬試験 ― 本番前の最終確認用
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          第1回(無料)で出た弱点は、本当に埋まりましたか？
          第1回と1問も重複しない初見の{p.questionCount}問で、本試験と同じ{p.timeLimitMin}分・
          合格基準「{p.passLabel}」の条件をもう一度通す1回分です。
        </p>
      </div>

      <Moshi2Gate certId={cert.id} pitch={pitch} />

      <p className="print-hide text-[12px] text-ink-faint mt-8 max-w-xl leading-relaxed">
        ※{p.specNote}
        本模試は当サイトのオリジナル問題で構成しており、実際の試験問題の転載ではありません。
        合否判定はあくまで学習の目安です。受験料・受験資格・試験日程などは変更されることがあるため、
        必ず実施団体の公式情報をご確認ください。
      </p>
    </div>
  );
}
