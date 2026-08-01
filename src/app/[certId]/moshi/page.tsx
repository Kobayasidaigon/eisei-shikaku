import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MoshiExam from "@/components/MoshiExam";
import JsonLd from "@/components/JsonLd";
import { SITE, OG_BASE, absUrl } from "@/data/site";
import { MOSHI } from "@/data/moshi";
import { EXTRA5 } from "@/data/moshi-extra5";
import { MOSHI_EXTRA_QUESTIONS } from "@/data/moshi-extra-questions";
import { certById, questionsOfCert, type CertId } from "@/data/questions";

// 「(資格名) 模試/模擬試験」クエリの受け皿。模試定義がある試験だけ静的生成する。
export function generateStaticParams() {
  return Object.keys(MOSHI).map((certId) => ({ certId }));
}

// 固定ペーパーの参照整合をビルド時に検証する(欠けたIDがあればビルドを落とす)
function paperOf(certId: CertId) {
  const def = MOSHI[certId];
  if (!def) return null;
  const pool = new Set(questionsOfCert(certId).map((q) => q.id));
  // 模試専用問題(組合せ形式・鑑別等)もペーパーの一部
  for (const q of MOSHI_EXTRA_QUESTIONS[certId] ?? []) pool.add(q.id);
  const missing = def.questionIds.filter((id) => !pool.has(id));
  if (missing.length > 0) {
    throw new Error(`moshi(${certId}): 問題IDが見つかりません: ${missing.join(", ")}`);
  }
  return def;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certId: string }>;
}): Promise<Metadata> {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  const def = MOSHI[certId as CertId];
  if (!cert || !def) return {};
  const n = def.questionIds.length;
  const title = `${cert.name} 模擬試験 第1回【${n}問・${def.timeLimitMin}分・無料】`;
  const description = def.isFullSpec
    ? `${cert.fullName}の無料模擬試験。本試験と同じ${n}問・${def.timeLimitMin}分・合格基準(${def.passLabel})で受験でき、終了後に合否判定・科目別判定・弱点分析・全問の解説を確認できます。`
    : `${cert.fullName}の無料模擬試験。${def.lead ?? `本試験相当のボリューム(${n}問・${def.timeLimitMin}分)を時間を計って解ける実戦形式。`}終了後に合否判定・科目別判定・弱点分析・全問の解説を確認できます。`;
  const url = `/${cert.id}/moshi/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OG_BASE, title, description, type: "website", url },
  };
}

export default async function MoshiPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  const def = cert ? paperOf(cert.id) : null;
  if (!cert || !def) notFound();

  const n = def.questionIds.length;
  const url = absUrl(`/${cert.id}/moshi/`);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ホーム", item: SITE.url },
        { "@type": "ListItem", position: 2, name: `${cert.name} 練習問題`, item: absUrl(`/${cert.id}/`) },
        { "@type": "ListItem", position: 3, name: "模擬試験 第1回", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": url,
      name: `${cert.name} 模擬試験 第1回`,
      description: `${cert.fullName}の無料模擬試験(${n}問・${def.timeLimitMin}分・合否判定つき)。`,
      url,
      inLanguage: "ja",
      author: { "@id": absUrl("/#author") },
      publisher: { "@id": absUrl("/#organization") },
    },
  ];

  return (
    <div className="fade-up">
      <JsonLd data={jsonLd} />

      {/* パンくず */}
      <nav className="text-[12px] text-ink-faint mb-4 flex flex-wrap gap-1" aria-label="パンくずリスト">
        <Link href="/" className="hover:text-ink-soft underline underline-offset-2">
          ホーム
        </Link>
        <span>/</span>
        <Link href={`/${cert.id}/`} className="hover:text-ink-soft underline underline-offset-2">
          {cert.name} 練習問題
        </Link>
        <span>/</span>
        <span className="text-ink-soft">模擬試験 第1回</span>
      </nav>

      {/* 見出し */}
      <div className="mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[27px] font-medium text-ink leading-snug tracking-tight">
          {cert.name} 模擬試験 第1回
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          {def.lead ??
            (def.isFullSpec
              ? `本試験と同じ${n}問・${def.timeLimitMin}分・同じ合格基準で受験できる無料の模擬試験です。`
              : `本試験相当のボリューム(${n}問・${def.timeLimitMin}分)を時間を計って解ける、無料の実戦形式模試です。`)}
          全員が同じ問題を同じ順序で解く固定問題なので、本番前の実力測定にそのまま使えます。
          終了後は合否判定{def.sections ? "(科目別判定つき)" : ""}・分野別の弱点分析・全問の解説つき。
        </p>
      </div>

      {/* 試験仕様 */}
      <div className="bg-surface border border-line rounded-[10px] p-5 mb-5 text-[13px] text-ink-soft space-y-1.5 max-w-xl">
        <p><span className="text-ink font-medium">出題数</span>　{n}問({def.choiceLabel ?? (EXTRA5[cert.id] ? "五肢択一・本試験と同じ" : "4択")}・本試験の科目出題順)</p>
        <p><span className="text-ink font-medium">制限時間</span>　{def.timeLimitMin}分(時間切れで自動採点)</p>
        <p><span className="text-ink font-medium">合格基準</span>　{def.passLabel}</p>
        <p><span className="text-ink font-medium">受験料</span>　無料・登録不要</p>
      </div>

      <MoshiExam certId={cert.id} />

      <p className="text-[12px] text-ink-faint mt-8 max-w-xl leading-relaxed">
        ※{def.specNote}
        本模試は当サイトのオリジナル問題で構成しており、実際の試験問題の転載ではありません。
        合否判定はあくまで学習の目安です。1問ずつじっくり学びたい方は
        <Link href={`/${cert.id}/`} className="underline underline-offset-2 hover:text-ink-soft">
          {cert.name}の練習問題
        </Link>
        へ。
      </p>
    </div>
  );
}
