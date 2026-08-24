import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QuizApp from "@/components/QuizApp";
import JsonLd from "@/components/JsonLd";
import AuthorBox from "@/components/AuthorBox";
import { SITE, AUTHOR, OG_BASE, absUrl } from "@/data/site";
import { COLUMNS } from "@/data/columns";
import { MOSHI } from "@/data/moshi";
import { moshi2ProductOf } from "@/data/products";
import Moshi2TopLink from "@/components/Moshi2TopLink";
import {
  CERTS,
  certById,
  categoriesOfCert,
  homeCertOfCategory,
  questionsOf,
  questionsOfCert,
  quizCountsFor,
  QUESTIONS_UPDATED_AT,
  type CertId,
} from "@/data/questions";

// 関連資格クラスタ。第一種・第二種は3科目が共通で受験者が比較検討するため、
// 本文にクラスタ語を供給して相互リンクさせる。
const RELATED_CLUSTER: CertId[] = ["eisei1", "eisei2"];

// 資格名×演習系クエリ(「第二種衛生管理者 練習問題/過去問」等)の受け皿となるSEO入口ページ。
// 問題データのある資格ぶんを静的生成する。
export function generateStaticParams() {
  return CERTS.filter((c) => questionsOfCert(c.id).length > 0).map((c) => ({ certId: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certId: string }>;
}): Promise<Metadata> {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  if (!cert) return {};
  const total = questionsOfCert(cert.id).length;
  // 高ボリューム語「過去問(対策)」を可視域に前方投入(本文で公式過去問ではない旨を明示済み)
  const title = `${cert.name} 練習問題・過去問対策【全${total}問・無料】`;
  const description = `${cert.fullName}の対策演習${total}問を無料公開。分野別の一問一答と本番形式モード(${Math.min(cert.examCount, total)}問・合格ライン${cert.passLine}%)で腕試しできます。全問に解説つき・過去問対策にも。`;
  const url = `/${cert.id}/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...OG_BASE,
      title,
      description,
      type: "website",
      url,
    },
  };
}

export default async function CertPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  if (!cert) notFound();

  const total = questionsOfCert(cert.id).length;
  // 分野ページのURLは所有者の試験に固定する(共通科目は第二種側が正準URL)。
  // 第一種のページからは第二種のURLへリンクし、重複コンテンツを作らない。
  const cats = categoriesOfCert(cert)
    .map((c) => ({
      ...c,
      count: questionsOf(cert.id, c.id).length,
      href: `/${homeCertOfCategory(c.id)}/${c.id}/`,
      shared: homeCertOfCategory(c.id) !== cert.id,
    }))
    .filter((c) => c.count > 0);
  const hasSharedCats = cats.some((c) => c.shared);
  const relatedColumns = COLUMNS.filter((c) => c.certId === cert.id);
  // 関連資格への文脈内相互リンク(第一種衛生管理者などを追加したら表示される)
  const siblingCerts = CERTS.filter((c) => c.id !== cert.id && questionsOfCert(c.id).length > 0);
  const isClusterMember = RELATED_CLUSTER.includes(cert.id);
  const url = absUrl(`/${cert.id}/`);
  const credential = {
    "@type": "EducationalOccupationalCredential",
    name: cert.fullName,
    credentialCategory: "国家資格",
  };

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ホーム", item: absUrl("/") },
        { "@type": "ListItem", position: 2, name: `${cert.name} 練習問題`, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": url,
      name: `${cert.name} 練習問題・一問一答ドリル`,
      description: `${cert.fullName}の対策演習${total}問を無料公開。`,
      url,
      inLanguage: "ja",
      isPartOf: { "@id": absUrl("/#website") },
      about: credential,
      dateModified: QUESTIONS_UPDATED_AT,
      author: { "@id": absUrl("/#author") },
      publisher: { "@id": absUrl("/#organization") },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${cert.name} 分野別一問一答`,
      itemListElement: cats.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(`/${cert.id}/${c.id}/`),
        name: `${cert.name}「${c.name}」一問一答`,
      })),
    },
  ];
  // 可視FAQと完全一致するFAQPage(事実が確立した資格のみ)
  if (cert.faq?.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: cert.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <div className="fade-up">
      <JsonLd data={jsonLd} />

      {/* パンくず */}
      <nav
        aria-label="パンくずリスト"
        className="text-[12px] text-ink-faint mb-4 flex flex-wrap gap-1"
      >
        <Link href="/" className="hover:text-ink-soft underline underline-offset-2">
          ホーム
        </Link>
        <span>/</span>
        <span className="text-ink-soft">{cert.name} 練習問題</span>
      </nav>

      {/* 見出し */}
      <div className="mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[27px] font-medium text-ink leading-snug tracking-tight">
          {cert.name} 練習問題・一問一答ドリル
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          {cert.fullName}
          {cert.name !== cert.fullName ? `(${cert.name})` : ""}
          {cert.aliases?.length ? `（${cert.aliases.join("・")}とも呼ばれます）` : ""}
          の対策演習を全{total}問、無料で公開しています。
          {cert.desc} 1問ごとに解説つき。公式の出題範囲にもとづき{AUTHOR.name}が作成しています。
          本サイトの問題は公式過去問ではありませんが、出題分野に沿って作成しており、過去問対策・直前の腕試しに使える構成です。
          アプリのインストールは不要、スマホのブラウザでそのまま演習できます。
        </p>
        {cert.authority && (
          <p className="mt-2 text-[11px] text-ink-faint leading-relaxed">
            実施団体：{cert.authority}。受験資格・試験日程・受験料など変動する情報は、必ず公式サイトでご確認ください。
          </p>
        )}
        <p className="mt-1 text-[11px] text-ink-faint tabular">問題データ最終更新 {QUESTIONS_UPDATED_AT}</p>
      </div>

      {/* 模擬試験への導線(模試定義がある試験のみ) */}
      {MOSHI[cert.id] && (
        <div className="mb-6 bg-surface border border-line rounded-[10px] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-soft leading-relaxed">
            時間を計って本番さながらに解くなら、固定{MOSHI[cert.id]!.questionIds.length}問・
            {MOSHI[cert.id]!.timeLimitMin}分・本試験どおりの合否判定つきの模擬試験へ。
          </p>
          <Link
            href={`/${cert.id}/moshi/`}
            className="bg-ink text-paper rounded-[8px] px-4 py-2 text-[13px] hover:bg-accent transition-colors shrink-0"
          >
            模擬試験 第1回を受ける →
          </Link>
          {moshi2ProductOf(cert.id) && (
            <Moshi2TopLink
              certId={cert.id}
              priceJpy={moshi2ProductOf(cert.id)!.priceJpy}
              className="rounded-[8px] border border-line-strong px-4 py-2 text-[13px] text-ink no-underline transition-colors hover:border-accent hover:text-accent-ink shrink-0"
            />
          )}
          {moshi2ProductOf(cert.id) && (
            <p className="w-full border-t border-line pt-3 text-[12px] text-ink-faint leading-relaxed">
              第2回は第1回と1問も重複しない別問題で、印刷用の紙面つきの買い切りです。
              商品ページにサンプル問題を解説つきで2問出しているので、中身を見てから決められます。
            </p>
          )}
        </div>
      )}

      {/* そのまま演習開始できるクイズ本体 */}
      <QuizApp initialCert={cert.id} counts={quizCountsFor(cert.id)} />

      {/* 分野別の一問一答ページ(サーバーレンダリングされた crawlable なリンク) */}
      <section className="mt-12">
        <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
          <h2 className="font-serif text-[16px] font-medium text-ink">
            分野別 一問一答(問題と解説を読む)
          </h2>
        </div>
        <p className="text-[12px] text-ink-soft mb-3.5 leading-relaxed">
          出題形式ではなく、問題・正解・解説をまとめて読みたい方はこちら。分野ごとに全問を掲載しています。
          {hasSharedCats &&
            "有害業務以外の3科目は第一種・第二種で共通のため、第二種のページにまとめて掲載しています(内容は同じです)。"}
        </p>
        <ul className="grid sm:grid-cols-2 gap-2.5">
          {cats.map((c) => (
            <li key={c.id}>
              <Link
                href={c.href}
                className="block rounded-[10px] border border-line bg-surface p-4 transition hover:border-accent no-underline"
              >
                <span className="block text-[14px] font-medium text-ink">
                  {c.shared ? "" : `${cert.name}`}「{c.name}」一問一答
                </span>
                <span className="block text-[11px] text-ink-soft mt-1">
                  {c.desc}(全{c.count}問{c.shared ? "・第一種と第二種で共通" : ""})
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* よくある質問(可視FAQ。JSON-LDのFAQPageと同一文言) */}
      {cert.faq?.length ? (
        <section className="mt-10">
          <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
            <h2 className="font-serif text-[16px] font-medium text-ink">{cert.name} のよくある質問</h2>
          </div>
          <div className="space-y-2.5">
            {cert.faq.map((f, i) => (
              <details key={i} className="rounded-[10px] border border-line bg-surface p-4">
                <summary className="cursor-pointer text-[14px] font-medium text-ink">{f.q}</summary>
                <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {/* 関連資格。第一種衛生管理者などを追加したら相互リンクさせる */}
      {siblingCerts.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
            <h2 className="font-serif text-[16px] font-medium text-ink">
              関連する資格
            </h2>
          </div>
          {isClusterMember && (
            <p className="text-[12px] text-ink-soft mb-3 leading-relaxed">
              第一種衛生管理者はすべての業種で選任でき、第二種は有害業務との関連が少ない業種に限られます。
              試験科目は「関係法令(有害業務以外)・労働衛生(有害業務以外)・労働生理」の3科目が共通で、
              第一種はこれに有害業務に係る2科目が加わります。本サイトではどちらも無料で対策できます。
            </p>
          )}
          <ul className="flex flex-wrap gap-2">
            {siblingCerts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${c.id}/`}
                  className="inline-block rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft no-underline transition hover:border-accent"
                >
                  {c.name}の練習問題
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 関連コラム */}
      {relatedColumns.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
            <h2 className="font-serif text-[16px] font-medium text-ink">{cert.name} の関連記事</h2>
          </div>
          <ul className="space-y-2">
            {relatedColumns.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/columns/${c.slug}/`}
                  className="text-[13px] text-accent-ink hover:text-accent underline underline-offset-2"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 著者(E-E-A-T: 構造化データPersonと可視情報を一致させる) */}
      <AuthorBox className="mt-10" />
    </div>
  );
}
