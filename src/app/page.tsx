import type { Metadata } from "next";
import Link from "next/link";
import QuizApp from "@/components/QuizApp";
import JsonLd from "@/components/JsonLd";
import { COLUMNS } from "@/data/columns";
import { CERTS, QUESTIONS, questionsOf, questionsOfCert, quizCountsFor } from "@/data/questions";
import { MOSHI } from "@/data/moshi";
import { SITE, absUrl } from "@/data/site";

export const metadata: Metadata = {
  // RSS の自動検出リンク(alternates は浅いマージのためページ側で types を併記する)
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
};

export default function Home() {
  // 資格入口への静的リンク(クライアントUIの外に crawlable な導線を置く)
  const guides = CERTS.map((cert) => ({
    cert,
    column: COLUMNS.find((c) => c.certId === cert.id),
    count: questionsOfCert(cert.id).length,
  })).filter((g) => g.count > 0);

  // 本文に出す実数(データと表示を必ず一致させる)
  const eisei1Count = questionsOfCert("eisei1").length;
  const eisei2Count = questionsOfCert("eisei2").length;
  const yugaiCount =
    questionsOf("eisei1", "e1-hourei-yugai").length + questionsOf("eisei1", "e1-eisei-yugai").length;
  const moshiCount = Object.keys(MOSHI).length;

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

      {/* 見出しとリード(初見の訪問者に、何のサイトかを最初の3秒で伝える) */}
      <div className="mb-8 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[27px] font-medium text-ink leading-snug tracking-tight">
          衛生管理者の過去問対策を、全{QUESTIONS.length}問で。
        </h1>
        <p className="mt-2.5 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          第一種・第二種衛生管理者試験の練習問題を、全問解説つきで無料公開しています。
          登録もアプリのインストールも不要。スマホのブラウザを開けば、その場で1問目から始められます。
        </p>
      </div>

      <QuizApp counts={quizCountsFor("eisei2")} hasPageH1 />

      {/* 収録内容(数字はすべてデータから算出。表示と実データがずれない) */}
      <section className="mt-12">
        <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
          <h2 className="font-serif text-[16px] font-medium text-ink">収録内容</h2>
          <span className="text-[10px] tracked uppercase text-ink-faint">Contents</span>
        </div>
        <p className="text-[13px] text-ink leading-relaxed">
          共通3科目(関係法令・労働衛生・労働生理／いずれも有害業務以外)に、第一種で加わる
          有害業務の2科目を合わせて全{QUESTIONS.length}問。
          第一種を受験する方は{eisei1Count}問、第二種を受験する方は{eisei2Count}問が対象です
          (共通3科目は両方の試験で同じ範囲のため、どちらからでも同じ問題に取り組めます)。
        </p>
        <ul className="mt-3.5 grid sm:grid-cols-2 gap-2.5">
          {[
            {
              t: "分野別の一問一答",
              d: "科目ごとに全問を一覧で掲載。問題・正解・解説をまとめて読み込めます。",
            },
            {
              t: "本番形式モード",
              d: "本試験相当の問題数をランダム出題し、合格ラインで判定します。",
            },
            {
              t: `模擬試験 第1回(${moshiCount}試験ぶん)`,
              d: "本試験と同じ問題数・時間・科目別の合格基準。時間を計って実力を測れます。",
            },
            {
              t: "有害業務の2科目",
              d: `第一種で差がつく範囲を${yugaiCount}問収録。作業環境測定や特殊健診の頻度まで。`,
            },
          ].map((f) => (
            <li key={f.t} className="rounded-[10px] border border-line bg-surface p-4">
              <span className="block text-[14px] font-medium text-ink">{f.t}</span>
              <span className="block text-[12px] text-ink-soft mt-1 leading-relaxed">{f.d}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 使い方(迷わせない3ステップ) */}
      <section className="mt-10">
        <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
          <h2 className="font-serif text-[16px] font-medium text-ink">おすすめの進め方</h2>
          <span className="text-[10px] tracked uppercase text-ink-faint">How to</span>
        </div>
        <ol className="space-y-2.5">
          {[
            {
              n: "1",
              t: "分野別で論点を覚える",
              d: "まずは科目ごとに解いて、解説まで読み込みます。とっつきやすい労働生理から始めるのがおすすめです。",
            },
            {
              n: "2",
              t: "本番形式で腕試し",
              d: "分野をまたいでランダムに出題されると、覚えたつもりの論点が炙り出されます。",
            },
            {
              n: "3",
              t: "模擬試験で仕上げる",
              d: "この試験は各科目40%未満で足切りになります。科目別の判定で、沈んでいる科目がないかを本番前に確認しましょう。",
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="grid place-items-center w-6 h-6 rounded-full bg-accent text-paper text-[12px] shrink-0 mt-0.5">
                {s.n}
              </span>
              <div>
                <span className="block text-[14px] font-medium text-ink">{s.t}</span>
                <span className="block text-[12.5px] text-ink-soft mt-0.5 leading-relaxed">{s.d}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 受験資格の注意(この試験に固有で、知らずに申し込む人が多い) */}
      <section className="mt-10">
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <div className="text-[11px] tracked text-accent-ink mb-1.5">受験を考えている方へ</div>
          <p className="text-[13px] text-ink leading-relaxed">
            衛生管理者試験には受験資格があります。学歴に応じた労働衛生の実務経験(大学卒で1年以上、
            高校卒で3年以上など)が必要で、申込みには事業者の証明書も要ります。
            勉強を始める前に、
            <Link
              href="/columns/eisei2-jyuken-shikaku/"
              className="text-accent-ink underline underline-offset-2 mx-0.5"
            >
              受験資格と実務経験の要件
            </Link>
            を確認しておくと確実です。
          </p>
        </div>
      </section>

      {/* 資格ガイド(既存の内部リンク集) */}
      {guides.length > 0 && (
        <section className="mt-10">
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

      {/* 位置づけの明示(公式過去問ではないことを、隠さず本文で伝える) */}
      <p className="mt-10 text-[12px] text-ink-faint leading-relaxed">
        本サイトの問題は、公式の出題範囲にもとづき編集部が作成した対策演習問題です。
        試験の公式過去問そのものではありません。受験履歴はお使いの端末内にのみ保存され、
        サーバーには送信されません。受験資格・試験日程・受験料など変動する情報は、
        必ず公益財団法人 安全衛生技術試験協会の公式サイトでご確認ください。
      </p>
    </>
  );
}
