import type { Metadata } from "next";
import Link from "next/link";
import { COLUMNS } from "@/data/columns";
import { certById, questionsOfCert } from "@/data/questions";
import { SITE, OG_BASE, absUrl } from "@/data/site";
import JsonLd from "@/components/JsonLd";

// タイトルのブランド名は layout の title.template が付与する
const PAGE_TITLE = "資格コラム";
const PAGE_DESC =
  "第二種衛生管理者の概要・難易度・受験資格・勉強法と、このドリルでの対策をまとめた資格ガイドコラム。";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: "/columns/" },
  openGraph: {
    ...OG_BASE,
    title: `${PAGE_TITLE}｜${SITE.name}`,
    description: PAGE_DESC,
    type: "website",
    url: "/columns/",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: absUrl("/") },
      { "@type": "ListItem", position: 2, name: "資格コラム", item: absUrl("/columns/") },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absUrl("/columns/"),
    name: "資格コラム",
    url: absUrl("/columns/"),
    inLanguage: "ja",
    isPartOf: { "@id": absUrl("/#website") },
    publisher: { "@id": absUrl("/#organization") },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: COLUMNS.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(`/columns/${c.slug}/`),
        name: c.shortTitle,
      })),
    },
  },
];

export default function ColumnsPage() {
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
        <span className="text-ink-soft">資格コラム</span>
      </nav>

      <div className="mb-7 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[26px] font-medium text-ink leading-snug tracking-tight">
          資格コラム
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          各資格の概要・難易度・受験資格・勉強法と、このドリルでの対策をまとめています。受験を考えている人の最初の1歩に。
        </p>
      </div>

      {COLUMNS.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-surface p-6 text-center">
          <p className="text-[13px] text-ink-soft leading-relaxed">
            コラムは現在準備中です。まずは
            <Link href="/" className="text-accent-ink underline underline-offset-2 mx-0.5">
              練習問題ドリル
            </Link>
            で腕試しをどうぞ。
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {COLUMNS.map((c) => {
            const cert = c.certId ? certById(c.certId) : undefined;
            const count = c.certId ? questionsOfCert(c.certId).length : 0;
            const kicker = cert?.name ?? c.kicker ?? "コラム";
            return (
              <Link
                key={c.slug}
                href={`/columns/${c.slug}/`}
                className="group rounded-[10px] border border-line bg-surface p-4 transition hover:border-accent"
              >
                <div className="text-[10px] tracked uppercase text-ink-faint mb-1.5">
                  {kicker}
                </div>
                <h2 className="font-serif text-[16px] font-medium text-ink leading-snug">
                  {c.shortTitle}
                </h2>
                <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">{c.lead}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-ink-faint tabular">
                    {c.certId ? `演習${count}問` : "読み物"}
                  </span>
                  <span className="text-[12px] text-accent group-hover:translate-x-0.5 transition">
                    読む →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
