import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SITE, AUTHOR, OG_BASE, absUrl } from "@/data/site";
import { QUESTIONS } from "@/data/questions";

const PAGE_TITLE = "運営者情報・編集方針";
const PAGE_DESC = `${SITE.name}の運営者(${AUTHOR.jobTitle}・${AUTHOR.name})と、問題作成・ファクトチェックの編集方針について。`;
// 信頼中核ページの最終更新日(内容を書き直したら更新する)
const UPDATED = "2026-07-19";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: "/about/" },
  openGraph: {
    ...OG_BASE,
    title: PAGE_TITLE,
    description: PAGE_DESC,
    type: "website",
    url: "/about/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": absUrl("/about/"),
  name: PAGE_TITLE,
  url: absUrl("/about/"),
  inLanguage: "ja",
  datePublished: UPDATED,
  dateModified: UPDATED,
  author: { "@id": absUrl("/#author") },
  mainEntity: { "@id": absUrl("/#author") },
};

export default function AboutPage() {
  return (
    <div className="fade-up">
      <JsonLd data={jsonLd} />
      <div className="mb-7 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[26px] font-medium text-ink leading-snug tracking-tight">
          運営者情報・編集方針
        </h1>
        <p className="mt-2 text-[12px] text-ink-faint tabular">最終更新 {UPDATED}</p>
      </div>

      <section className="mb-8">
        <h2 className="font-serif text-[17px] font-medium text-ink pb-1.5 border-b border-line">
          運営者
        </h2>
        <div className="mt-3.5 flex items-start gap-3.5">
          <span className="grid place-items-center w-11 h-11 rounded-full bg-accent text-paper font-serif text-[17px] shrink-0">
            {AUTHOR.name.slice(0, 1)}
          </span>
          <div>
            <div className="text-[14px] text-ink font-medium">
              {AUTHOR.name}
              <span className="ml-2 text-[12px] text-ink-soft">{AUTHOR.jobTitle}</span>
            </div>
            <p className="mt-1.5 text-[13px] text-ink leading-relaxed">{AUTHOR.description}</p>
            <p className="mt-1.5 text-[13px] text-ink leading-relaxed">
              資格クイズサイト「シカクモン」(shikakumon.com)の運営者と同一で、本サイトはその衛生管理者版として運営しています。
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-[17px] font-medium text-ink pb-1.5 border-b border-line">
          このサイトについて
        </h2>
        <p className="mt-3 text-[13px] text-ink leading-relaxed">
          {SITE.name}は、第二種衛生管理者試験(関係法令・労働衛生・労働生理の3科目)に対応した、全
          {QUESTIONS.length}問の無料練習問題サイトです。すべての問題に解説を付け、本番形式モード(本試験相当数をランダム出題・合格ライン判定)と模擬試験を用意しています。
          アプリのインストールは不要で、受験履歴はお使いの端末内にのみ保存されます。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-[17px] font-medium text-ink pb-1.5 border-b border-line">
          編集方針(問題の作り方と正確性)
        </h2>
        <ul className="mt-3 space-y-2">
          {[
            "問題と解説は、公式の出題範囲と一般的な労働衛生の知識(関係法令・労働衛生・労働生理)にもとづいて作成し、公開前に全問の構造チェックと独立したファクトチェックを通しています。",
            "本サイトの問題は各試験の公式過去問ではありません。出題分野に沿った対策演習として作成しています。",
            "受験資格・受験料・試験日程・合格率などの変動する情報は断定せず、必ず各団体の公式サイトの確認を案内しています。",
            "誤りの指摘は歓迎します。確認のうえ、事実に基づいて速やかに修正します。",
          ].map((t, i) => (
            <li key={i} className="relative pl-4 text-[13px] text-ink leading-relaxed">
              <span className="absolute left-0 text-accent">・</span>
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-ink leading-relaxed">
          誤りに気づいた方は
          <Link href="/contact/" className="text-accent-ink underline underline-offset-2 mx-0.5">
            お問い合わせ
          </Link>
          からご連絡ください。
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[17px] font-medium text-ink pb-1.5 border-b border-line">
          関連ページ
        </h2>
        <ul className="mt-3 space-y-2 text-[13px]">
          <li>
            <Link href="/privacy/" className="text-accent-ink hover:text-accent underline underline-offset-2">
              プライバシーポリシー
            </Link>
          </li>
          <li>
            <Link href="/contact/" className="text-accent-ink hover:text-accent underline underline-offset-2">
              お問い合わせ
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
