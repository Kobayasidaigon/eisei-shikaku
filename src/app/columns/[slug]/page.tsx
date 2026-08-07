import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COLUMNS, columnBySlug, columnDates, type Column } from "@/data/columns";
import { categoriesOfCert, certById, categoryName, homeCertOfCategory, questionsOf, questionsOfCert, QUESTIONS } from "@/data/questions";
import { SITE, AUTHOR, OG_BASE, absUrl } from "@/data/site";
import JsonLd from "@/components/JsonLd";
import AuthorBox from "@/components/AuthorBox";
import ColumnScrollPing from "@/components/ColumnScrollPing";

export function generateStaticParams() {
  return COLUMNS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = columnBySlug(slug);
  if (!c) return {};
  const url = `/columns/${c.slug}/`;
  const { published, modified } = columnDates(c);
  return {
    // ブランド名サフィックスは layout の title.template が付与する
    title: c.title,
    description: c.lead,
    alternates: { canonical: url },
    openGraph: {
      ...OG_BASE,
      title: c.title,
      description: c.lead,
      type: "article",
      url,
      publishedTime: published,
      modifiedTime: modified,
      authors: [AUTHOR.name],
    },
  };
}

// 記事間の関連リンク自動選定。
// certId 直接一致 → slug 内の資格トークン一致(比較記事など) → 同一 kicker の順。
// slug と certId が一致しないことがある場合に備え、certId ごとの slug トークン表で照合する。
const CERT_TOKENS: Record<string, string[]> = {
  eisei2: ["eisei2", "eiseikanri", "eisei-kanri"],
  eisei1: ["eisei1"],
};

function relatedColumns(current: Column): Column[] {
  if (current.related?.length) {
    return current.related
      .map((s) => columnBySlug(s))
      .filter((c): c is Column => !!c && c.slug !== current.slug)
      .slice(0, 4);
  }
  const picked = new Map<string, Column>();
  const add = (c: Column) => {
    if (c.slug !== current.slug && !picked.has(c.slug)) picked.set(c.slug, c);
  };
  if (current.certId) {
    COLUMNS.filter((c) => c.certId === current.certId).forEach(add);
    for (const token of CERT_TOKENS[current.certId] ?? []) {
      COLUMNS.filter((c) => !c.certId && c.slug.includes(token)).forEach(add);
    }
  } else {
    for (const [certId, tokens] of Object.entries(CERT_TOKENS)) {
      if (tokens.some((t) => current.slug.includes(t))) {
        COLUMNS.filter((c) => c.certId === certId).forEach(add);
      }
    }
  }
  if (current.kicker) {
    COLUMNS.filter((c) => c.kicker === current.kicker).forEach(add);
  }
  return [...picked.values()].slice(0, 4);
}

export default async function ColumnArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = columnBySlug(slug);
  if (!c) notFound();
  const cert = c.certId ? certById(c.certId) : undefined;
  const count = c.certId ? questionsOfCert(c.certId).length : 0;
  const kicker = cert?.name ?? c.kicker ?? "コラム";
  const url = absUrl(`/columns/${c.slug}/`);
  const { published, modified } = columnDates(c);
  const related = relatedColumns(c);
  // certId の無い記事でも drill 指定があれば、内容に対応する分野別一問一答へ直接リンクする
  const drill = !cert && c.drill ? c.drill : undefined;
  const drillCert = drill ? certById(drill.certId) : undefined;
  const drillCount = drill ? questionsOf(drill.certId, drill.categoryId).length : 0;
  const drillCatName = drill ? categoryName(drill.categoryId) : "";

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      headline: c.title,
      description: c.lead,
      inLanguage: "ja",
      mainEntityOfPage: url,
      url,
      datePublished: published,
      dateModified: modified,
      image: absUrl("/og-default.png"),
      isPartOf: { "@id": absUrl("/#website") },
      ...(cert
        ? {
            about: {
              "@type": "EducationalOccupationalCredential",
              name: cert.fullName,
              credentialCategory: "国家資格",
            },
          }
        : {}),
      author: { "@id": absUrl("/#author") },
      publisher: { "@id": absUrl("/#organization") },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ホーム", item: SITE.url },
        { "@type": "ListItem", position: 2, name: "資格コラム", item: absUrl("/columns/") },
        { "@type": "ListItem", position: 3, name: c.shortTitle, item: url },
      ],
    },
  ];

  return (
    <article className="fade-up">
      <JsonLd data={jsonLd} />
      <ColumnScrollPing slug={c.slug} />
      {/* パンくず(可視。JSON-LDのBreadcrumbListと一致) */}
      <nav
        aria-label="パンくずリスト"
        className="text-[12px] text-ink-faint mb-1 flex flex-wrap gap-1"
      >
        <Link href="/" className="hover:text-ink-soft underline underline-offset-2">
          ホーム
        </Link>
        <span>/</span>
        <Link href="/columns/" className="hover:text-ink-soft underline underline-offset-2">
          資格コラム
        </Link>
        <span>/</span>
        <span className="text-ink-soft">{c.shortTitle}</span>
      </nav>

      <div className="mt-3 text-[11px] tracked uppercase text-ink-faint">{kicker}</div>
      <h1 className="font-serif text-[25px] sm:text-[28px] font-medium text-ink mt-1.5 leading-snug tracking-tight">
        {c.title}
      </h1>
      <div className="mt-2 text-[11px] text-ink-faint tabular">
        公開 {published}
        {modified !== published && <span className="ml-2">更新 {modified}</span>}
      </div>
      <p className="mt-3 text-[14px] text-ink-soft leading-relaxed">{c.lead}</p>

      <div className="mt-8 space-y-7">
        {c.sections.map((s, i) => (
          <section key={i}>
            <h2 className="font-serif text-[18px] font-medium text-ink pb-1.5 border-b border-line">
              {s.heading}
            </h2>
            {s.body && (
              <p className="mt-2.5 text-[14px] text-ink leading-relaxed">{s.body}</p>
            )}
            {s.list && (
              <ul className="mt-2.5 space-y-1.5">
                {s.list.map((li, j) => (
                  <li key={j} className="relative pl-4 text-[14px] text-ink leading-relaxed">
                    <span className="absolute left-0 text-accent">・</span>
                    {li}
                  </li>
                ))}
              </ul>
            )}
            {s.table && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr>
                      {s.table.headers.map((h, j) => (
                        <th
                          key={j}
                          className="text-left font-medium text-ink-soft border-b border-line-strong px-3 py-2 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td
                            key={k}
                            className={`border-b border-line px-3 py-2 leading-relaxed align-top ${
                              k === 0 ? "text-ink whitespace-nowrap" : "text-ink-soft"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.link && (
              <p className="mt-2.5 text-[13px]">
                <a
                  href={s.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 hover:text-accent-ink"
                >
                  {s.link.label} →
                </a>
              </p>
            )}
          </section>
        ))}
      </div>

      {/* ドリルへのCTA(資格別入口 or 記事内容に対応する分野別一問一答へ。アンカーテキストに資格名・分野名を含める) */}
      <div className="mt-9 rounded-[12px] border border-line-strong bg-surface p-5 sm:p-6">
        <div className="font-serif text-[17px] font-medium text-ink">
          {cert
            ? `${cert.name} の問題を解いてみる`
            : drillCert
              ? `この内容を${drillCert.name}の問題で確かめる`
              : "ドリルで腕試し"}
        </div>
        <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
          {cert
            ? `${cert.fullName}・全${count}問。本番形式で本試験に近い問題数をランダム出題し、合格ラインで判定します。`
            : drillCert
              ? `記事で扱った内容は「${drillCatName}」分野の演習問題に対応しています。問題・正解・解説をまとめて読める一問一答を無料公開中。`
              : `全${QUESTIONS.length}問の対策演習を無料で用意。気になる資格を本番形式で力試しできます。`}
        </p>
        <Link
          href={
            cert
              ? `/${c.certId}/`
              : drill
                ? `/${homeCertOfCategory(drill.categoryId)}/${drill.categoryId}/`
                : "/"
          }
          className="inline-block mt-4 rounded-[8px] bg-accent text-white text-[14px] font-medium px-5 py-2.5 transition hover:bg-accent-ink"
        >
          {cert
            ? `${cert.name}の練習問題を解く(全${count}問) →`
            : drillCert
              ? `${drillCert.name}「${drillCatName}」の一問一答(全${drillCount}問) →`
              : "ドリルで演習する →"}
        </Link>
      </div>

      {/* 分野別一問一答へのクラスタリンク(資格に紐づく記事のみ。クロール経路と分野キーワードのアンカーを供給) */}
      {cert && (
        <section className="mt-6">
          <div className="text-[11px] tracked text-ink-faint mb-2.5">{cert.name} の分野別一問一答</div>
          <ul className="flex flex-wrap gap-2">
            {categoriesOfCert(cert)
              .map((cat) => ({
                ...cat,
                count: questionsOf(cert.id, cat.id).length,
                // 共通科目のURLは所有者(第二種)側にしか存在しない
                href: `/${homeCertOfCategory(cat.id)}/${cat.id}/`,
              }))
              .filter((cat) => cat.count > 0)
              .map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={cat.href}
                    className="inline-block rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-soft no-underline transition hover:border-accent"
                  >
                    {cat.name}(全{cat.count}問)
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* 関連記事(トピッククラスタの内部リンク) */}
      {related.length > 0 && (
        <section className="mt-8">
          <div className="text-[11px] tracked text-ink-faint mb-2.5">関連記事</div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/columns/${r.slug}/`}
                className="group rounded-[10px] border border-line bg-surface p-3.5 transition hover:border-accent no-underline"
              >
                <div className="text-[13px] font-medium text-ink leading-snug">{r.shortTitle}</div>
                <div className="mt-1.5 text-[11px] text-accent group-hover:translate-x-0.5 transition">
                  読む →
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 著者(E-E-A-T: 構造化データの Person と可視情報を一致させる) */}
      <AuthorBox className="mt-8" />

      {/* 姉妹サービス: シカクモンスタジオ(記事末の二次導線。主役は上のドリルCTA、琥珀は使わない) */}
      <a
        href={`${SITE.studioUrl}?utm_source=eisei&utm_medium=referral&utm_content=column_footer`}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-3 rounded-[12px] border border-line bg-surface p-5 transition hover:border-accent"
      >
        <div className="text-[11px] tracked text-ink-faint">姉妹サービス</div>
        <div className="font-serif text-[15px] font-medium text-ink mt-1">
          読んだ内容を、自分の教材で定着させる
        </div>
        <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
          資格名や分野を入力するだけ、または手元の教材PDF・写真から、AIが4択問題と解説を生成。間違えた問題は忘却曲線で自動復習できます。
        </p>
        <span className="inline-block mt-3 text-[13px] text-accent">
          シカクモン Studio を無料で試す →
        </span>
      </a>
    </article>
  );
}
