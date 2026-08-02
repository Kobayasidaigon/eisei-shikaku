import type { Metadata } from "next";
import Link from "next/link";
import QuizApp from "@/components/QuizApp";
import JsonLd from "@/components/JsonLd";
import { COLUMNS } from "@/data/columns";
import { CERTS, QUESTIONS, questionsOfCert, quizCountsFor } from "@/data/questions";
import { SITE, absUrl } from "@/data/site";

export const metadata: Metadata = {
  // RSS の自動検出リンク(alternates は浅いマージのためページ側で types を併記する)
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
};

export default function Home() {
  // 資格入口への静的リンク(クライアントUIの外に crawlable な導線を置く)。
  // コラムの有無に関わらず、問題のある5資格すべてをホーム本文からリンクする。
  const guides = CERTS.map((cert) => ({
    cert,
    column: COLUMNS.find((c) => c.certId === cert.id),
    count: questionsOfCert(cert.id).length,
  })).filter((g) => g.count > 0);

  // ホーム=5資格のハブであることを機械可読にする(CollectionPage + 収録資格の ItemList)
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": absUrl("/#webpage"),
      url: SITE.url,
      name: `${SITE.tagline}｜${SITE.name}`,
      inLanguage: "ja",
      isPartOf: { "@id": absUrl("/#website") },
      about: { "@type": "Thing", name: "第一種・第二種衛生管理者(関係法令・労働衛生・労働生理)の練習問題" },
      publisher: { "@id": absUrl("/#organization") },
      mainEntity: {
        "@type": "ItemList",
        name: "収録資格の練習問題",
        itemListElement: guides.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absUrl(`/${g.cert.id}/`),
          name: `${g.cert.name} 練習問題`,
        })),
      },
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <QuizApp counts={quizCountsFor("eisei2")} />
      <p className="mt-8 text-[12px] text-ink-soft leading-relaxed">
        第一種・第二種衛生管理者に対応。共通3科目(関係法令・労働衛生・労働生理／いずれも有害業務以外)に、
        第一種の有害業務2科目を加えた全{QUESTIONS.length}問を無料で公開しています。分野別の一問一答から本番形式・模擬試験まで、
        アプリのインストール不要でスマホのブラウザでそのまま演習でき、受験履歴はこの端末内にだけ保存されます。
      </p>
      {guides.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
            <h2 className="font-serif text-[16px] font-medium text-ink">資格ガイド</h2>
            <span className="text-[10px] tracked uppercase text-ink-faint">Guides</span>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {guides.map(({ cert, column, count }) => (
              <li key={cert.id} className="text-[13px] leading-relaxed">
                {column ? (
                  <>
                    <Link
                      href={`/columns/${column.slug}/`}
                      className="text-accent-ink hover:text-accent underline underline-offset-2"
                    >
                      {cert.name}｜{column.shortTitle}
                    </Link>
                    <span className="text-ink-faint text-[11px] ml-1.5">
                      /{" "}
                      <Link href={`/${cert.id}/`} className="hover:text-accent">
                        練習問題（全{count}問）
                      </Link>
                    </span>
                  </>
                ) : (
                  <Link
                    href={`/${cert.id}/`}
                    className="text-accent-ink hover:text-accent underline underline-offset-2"
                  >
                    {cert.name}の練習問題（全{count}問）
                  </Link>
                )}
              </li>
            ))}
            <li className="text-[13px]">
              <Link
                href="/columns/"
                className="text-ink-soft hover:text-accent underline underline-offset-2"
              >
                コラム一覧を見る →
              </Link>
            </li>
          </ul>
        </section>
      )}
    </>
  );
}
