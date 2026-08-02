import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import AuthorBox from "@/components/AuthorBox";
import { SITE, AUTHOR, OG_BASE, absUrl } from "@/data/site";
import { topicOf } from "@/data/topics";
import { COLUMNS } from "@/data/columns";
import {
  CERTS,
  certById,
  categoriesOfCert,
  categoryName,
  homeCertOfCategory,
  ownedCategoriesOfCert,
  questionsOf,
  QUESTIONS_UPDATED_AT,
  type CertId,
  type CategoryId,
} from "@/data/questions";

// 分野ごとの「一問一答」ページ。全問題・正解・解説を静的HTMLとして出力する。
// クイズUI(クライアント描画)の中にしか存在しなかった問題文をクローラに読める形にする。
//
// 共通科目(第一種・第二種で同一の3科目)は、URL所有者の試験でのみ生成する
// (ownedCategoriesOfCert)。両方で生成すると同じ問題が2つのURLに出て重複コンテンツになる。
export function generateStaticParams() {
  return CERTS.flatMap((cert) =>
    ownedCategoriesOfCert(cert)
      .filter((cat) => questionsOf(cert.id, cat.id).length > 0)
      .map((cat) => ({ certId: cert.id, categoryId: cat.id }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certId: string; categoryId: string }>;
}): Promise<Metadata> {
  const { certId, categoryId } = await params;
  const cert = certById(certId as CertId);
  if (!cert) return {};
  const questions = questionsOf(cert.id, categoryId as CategoryId);
  if (questions.length === 0) return {};
  const catName = categoryName(categoryId as CategoryId);
  // SERP のモバイル表示(全角30字前後)で切れない長さに収める。「解説つき/無料」は description 側で訴求
  const title = `${cert.name} ${catName}の一問一答 全${questions.length}問`;
  const description = `${cert.fullName}の「${catName}」分野の練習問題${questions.length}問を、正解と解説つきで無料公開。4択の演習モードでも同じ問題を解けます。`;
  const url = `/${cert.id}/${categoryId}/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...OG_BASE,
      title,
      description,
      type: "article",
      url,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ certId: string; categoryId: string }>;
}) {
  const { certId, categoryId } = await params;
  const cert = certById(certId as CertId);
  if (!cert) notFound();
  const questions = questionsOf(cert.id, categoryId as CategoryId);
  if (questions.length === 0) notFound();
  const catName = categoryName(categoryId as CategoryId);
  const url = absUrl(`/${cert.id}/${categoryId}/`);
  const letters = ["a", "b", "c", "d"];
  // 他分野へのリンクは、その分野のURL所有者(共通科目なら第二種)へ向ける
  const otherCats = categoriesOfCert(cert)
    .filter((c) => c.id !== categoryId && questionsOf(cert.id, c.id).length > 0)
    .map((c) => ({
      ...c,
      count: questionsOf(cert.id, c.id).length,
      href: `/${homeCertOfCategory(c.id)}/${c.id}/`,
    }));
  // 記事(最大の本文ページ)→ 対応する資格コラムへの逆リンクで topic cluster を閉じる
  const relatedColumns = COLUMNS.filter((c) => c.certId === cert.id);

  // Quiz スキーマは最小構成 + エンティティ結線(著者/発行者/対象国家資格/更新日)。
  // Google の practice problems リッチリザルトは提供終了済みで、hasPart による全問マークアップは
  // ページ重量に見合わないため撤去済み。問題文・正解・解説は可視HTMLとしてクローラに読める。
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Quiz",
      "@id": `${url}#quiz`,
      name: `${cert.name}「${catName}」一問一答`,
      url,
      inLanguage: "ja",
      datePublished: QUESTIONS_UPDATED_AT,
      dateModified: QUESTIONS_UPDATED_AT,
      about: {
        "@type": "EducationalOccupationalCredential",
        name: cert.fullName,
        credentialCategory: "国家資格",
      },
      educationalAlignment: [
        {
          "@type": "AlignmentObject",
          alignmentType: "educationalSubject",
          targetName: cert.fullName,
        },
      ],
      isPartOf: { "@id": absUrl("/#website") },
      author: { "@id": absUrl("/#author") },
      publisher: { "@id": absUrl("/#organization") },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ホーム", item: absUrl("/") },
        { "@type": "ListItem", position: 2, name: `${cert.name} 練習問題`, item: absUrl(`/${cert.id}/`) },
        { "@type": "ListItem", position: 3, name: `${catName} 一問一答`, item: url },
      ],
    },
  ];

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
        <Link href={`/${cert.id}/`} className="hover:text-ink-soft underline underline-offset-2">
          {cert.name} 練習問題
        </Link>
        <span>/</span>
        <span className="text-ink-soft">{catName}</span>
      </nav>

      {/* 見出し */}
      <div className="mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[23px] sm:text-[26px] font-medium text-ink leading-snug tracking-tight">
          {cert.name}「{catName}」一問一答(全{questions.length}問)
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          {cert.fullName}の「{catName}」分野の練習問題です。「答えと解説を見る」を開くと正解と解説を確認できます。
          {AUTHOR.jobTitle}の{AUTHOR.name}が作成。4択の演習モードで解きたい方は
          <Link href={`/${cert.id}/`} className="text-accent-ink underline underline-offset-2 mx-0.5">
            {cert.name}のドリル
          </Link>
          へ。
        </p>
        <p className="mt-1 text-[11px] text-ink-faint tabular">問題データ最終更新 {QUESTIONS_UPDATED_AT}</p>
      </div>

      {/* 問題一覧 */}
      <div className="space-y-5">
        {questions.map((q, i) => (
          <article key={q.id} className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
            {/* 見出しに問題文本体を含める(「問N」ボイラープレートだけの h2 にしない) */}
            <h2>
              <span className="block text-[11px] tracked text-ink-faint mb-2">問{i + 1}</span>
              <span className="block font-serif text-[15px] sm:text-[16px] font-medium text-ink leading-relaxed">
                {q.q}
              </span>
            </h2>
            <ol className="mt-3 space-y-1.5">
              {q.choices.map((choice, j) => (
                <li key={j} className="flex items-start gap-2 text-[13px] text-ink leading-relaxed">
                  <span className="grid place-items-center w-5 h-5 rounded-full border border-line-strong text-[11px] text-ink-soft shrink-0 mt-0.5">
                    {letters[j]}
                  </span>
                  {choice}
                </li>
              ))}
            </ol>
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[13px] text-accent-ink hover:text-accent underline underline-offset-2">
                答えと解説を見る
              </summary>
              <div className="mt-2.5 rounded-[8px] bg-accent-wash/60 p-3.5">
                <p className="text-[13px] text-ink">
                  <span className="font-medium">正解：{letters[q.answer]}.</span> {q.choices[q.answer]}
                </p>
                <p className="mt-1.5 text-[12px] text-ink-soft leading-relaxed">{q.explain}</p>
              </div>
            </details>
            {/* 1問1ページへの導線(アンカーに論点名を含める) */}
            <p className="mt-2.5">
              <Link
                href={`/${cert.id}/${categoryId}/${q.id}/`}
                className="text-[12px] text-ink-faint hover:text-accent underline underline-offset-2"
              >
                この問題のページ：{topicOf(q)} →
              </Link>
            </p>
          </article>
        ))}
      </div>

      {/* 演習モードへのCTA */}
      <Link
        href={`/${cert.id}/`}
        className="block mt-8 rounded-[10px] bg-ink text-paper px-5 py-4 text-center no-underline transition hover:bg-accent"
      >
        <span className="text-[15px] font-medium">{cert.name}を4択ドリルで演習する →</span>
        <span className="block text-[11px] text-paper/60 mt-0.5">
          本番形式・分野別・ミックスから選べます(無料)
        </span>
      </Link>

      {/* 他の分野 */}
      {otherCats.length > 0 && (
        <section className="mt-9">
          <div className="text-[11px] tracked text-ink-faint mb-2.5">{cert.name} の他の分野</div>
          <ul className="flex flex-wrap gap-2">
            {otherCats.map((c) => (
              <li key={c.id}>
                <Link
                  href={c.href}
                  className="inline-block rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft no-underline transition hover:border-accent"
                >
                  {c.name}(全{c.count}問)
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* この資格の勉強法・過去問ガイド(記事→コラムの逆リンクでクラスタを閉じる) */}
      {relatedColumns.length > 0 && (
        <section className="mt-9">
          <div className="text-[11px] tracked text-ink-faint mb-2.5">{cert.name} の勉強法・過去問ガイド</div>
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

      {cert.authority && (
        <p className="mt-8 text-[11px] text-ink-faint leading-relaxed">
          実施団体：{cert.authority}。受験資格・試験日程・受験料など変動する情報は、必ず公式サイトでご確認ください。
        </p>
      )}

      {/* 著者(E-E-A-T) */}
      <AuthorBox className="mt-6" />
    </div>
  );
}
