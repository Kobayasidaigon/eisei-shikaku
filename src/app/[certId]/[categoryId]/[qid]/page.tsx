import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import AuthorBox from "@/components/AuthorBox";
import { AUTHOR, OG_BASE, absUrl } from "@/data/site";
import { COLUMNS } from "@/data/columns";
import { topicOf } from "@/data/topics";
import {
  CERTS,
  certById,
  categoryName,
  ownedCategoriesOfCert,
  questionsOf,
  QUESTIONS_UPDATED_AT,
  type CertId,
  type CategoryId,
} from "@/data/questions";

// 1問1ページ。分野ページ(全問一覧)に対して「論点タイトルを持つ個別の受け皿」を作り、
// 問題文そのものを検索する受験者と論点名のロングテールを拾う(本体シカクモンで実証済みの構成)。
//
// 分野ページと同じく、共通科目はURL所有者の試験でのみ生成する(重複コンテンツ防止)。
export function generateStaticParams() {
  return CERTS.flatMap((cert) =>
    ownedCategoriesOfCert(cert).flatMap((cat) =>
      questionsOf(cert.id, cat.id).map((q) => ({
        certId: cert.id,
        categoryId: cat.id,
        qid: q.id,
      }))
    )
  );
}

function locate(certId: string, categoryId: string, qid: string) {
  const cert = certById(certId as CertId);
  if (!cert) return null;
  const questions = questionsOf(cert.id, categoryId as CategoryId);
  const idx = questions.findIndex((x) => x.id === qid);
  if (idx === -1) return null;
  return { cert, questions, idx, q: questions[idx] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certId: string; categoryId: string; qid: string }>;
}): Promise<Metadata> {
  const { certId, categoryId, qid } = await params;
  const found = locate(certId, categoryId, qid);
  if (!found) return {};
  const { cert, questions, idx, q } = found;
  const catName = categoryName(categoryId as CategoryId);
  const topic = topicOf(q);
  const n = idx + 1;
  // 論点を先頭に置く(SERPで切り捨てられる末尾ではなく前方に固有キーワード)
  const title = `${topic}｜${cert.name} 練習問題 問${n}`;
  const headSrc = q.q.replace(/\s+/g, " ").trim();
  const head = headSrc.length > 55 ? `${headSrc.slice(0, 55)}…` : headSrc;
  const description = `${cert.fullName}の練習問題「${catName}」問${n}/${questions.length}。問題「${head}」の正解と詳しい解説を無料公開。公式の出題範囲にもとづく対策演習です。`;
  const url = `/${cert.id}/${categoryId}/${qid}/`;
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

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ certId: string; categoryId: string; qid: string }>;
}) {
  const { certId, categoryId, qid } = await params;
  const found = locate(certId, categoryId, qid);
  if (!found) notFound();
  const { cert, questions, idx, q } = found;
  const catName = categoryName(categoryId as CategoryId);
  const topic = topicOf(q);
  const n = idx + 1;
  const total = questions.length;
  const url = absUrl(`/${cert.id}/${categoryId}/${qid}/`);
  const letters = ["a", "b", "c", "d"];
  const prevQ = idx > 0 ? questions[idx - 1] : null;
  const nextQ = idx < total - 1 ? questions[idx + 1] : null;
  // 同分野の近傍問題(前後3問ずつを目安に最大6問)。論点アンカーで相互リンクする
  const start = Math.max(0, Math.min(idx - 3, total - 7));
  const siblings = questions.slice(start, start + 7).filter((x) => x.id !== q.id);
  const relatedColumns = COLUMNS.filter((c) => c.certId === cert.id).slice(0, 3);

  // Quiz スキーマは分野ページと同じ最小構成 + エンティティ結線(著者/発行者/対象国家資格/更新日)
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Quiz",
      "@id": `${url}#quiz`,
      name: `${topic}(${cert.name} 練習問題 問${n})`,
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
        { "@type": "ListItem", position: 3, name: `${catName} 一問一答`, item: absUrl(`/${cert.id}/${categoryId}/`) },
        { "@type": "ListItem", position: 4, name: `問${n}`, item: url },
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
        <Link href={`/${cert.id}/${categoryId}/`} className="hover:text-ink-soft underline underline-offset-2">
          {catName}
        </Link>
        <span>/</span>
        <span className="text-ink-soft">問{n}</span>
      </nav>

      {/* 見出し(h1=論点) */}
      <div className="mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[23px] sm:text-[26px] font-medium text-ink leading-snug tracking-tight">
          {topic}
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          {cert.name}「{catName}」の練習問題 問{n}(全{total}問)。正解と解説つき。
          {AUTHOR.name}が作成し、独立した検証を経て公開しています。4択の演習モードで解きたい方は
          <Link href={`/${cert.id}/`} className="text-accent-ink underline underline-offset-2 mx-0.5">
            {cert.name}のドリル
          </Link>
          へ。
        </p>
        <p className="mt-1 text-[11px] text-ink-faint tabular">問題データ最終更新 {QUESTIONS_UPDATED_AT}</p>
      </div>

      {/* 問題 */}
      <article className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
        <h2>
          <span className="block text-[11px] tracked text-ink-faint mb-2">問題</span>
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
      </article>

      {/* 前後の問題ナビ */}
      <nav className="mt-6 flex justify-between items-center gap-3 pt-4 border-t border-line">
        {prevQ ? (
          <Link
            href={`/${cert.id}/${categoryId}/${prevQ.id}/`}
            className="text-[13px] text-ink-soft no-underline hover:text-accent"
          >
            ← 問{n - 1}
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={`/${cert.id}/${categoryId}/`}
          className="text-[13px] text-accent-ink underline underline-offset-2 hover:text-accent"
        >
          {catName}の一問一答一覧(全{total}問)
        </Link>
        {nextQ ? (
          <Link
            href={`/${cert.id}/${categoryId}/${nextQ.id}/`}
            className="text-[13px] text-ink-soft no-underline hover:text-accent"
          >
            問{n + 1} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

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

      {/* 同分野の他の問題(論点アンカーの相互リンク) */}
      {siblings.length > 0 && (
        <section className="mt-9">
          <div className="text-[11px] tracked text-ink-faint mb-2.5">
            「{catName}」の他の問題
          </div>
          <ul className="space-y-2">
            {siblings.map((s) => {
              const sn = questions.findIndex((x) => x.id === s.id) + 1;
              return (
                <li key={s.id}>
                  <Link
                    href={`/${cert.id}/${categoryId}/${s.id}/`}
                    className="text-[13px] text-accent-ink hover:text-accent underline underline-offset-2"
                  >
                    問{sn}：{topicOf(s)}
                  </Link>
                </li>
              );
            })}
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
