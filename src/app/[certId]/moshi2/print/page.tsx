import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Moshi2Print from "@/components/Moshi2Print";
import { moshi2CertIds, moshi2ProductOf } from "@/data/products";
import { certById, type CertId } from "@/data/questions";

// 販売中の資格だけ生成する。ページ自体に有料の問題データは含まれず、
// 紙面は購入者判定を通した API から届く。
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
  return {
    title: `${cert.name} 模擬試験 第2回 印刷用`,
    // 購入者向けの実務ページで、検索から入っても何もできない。
    // 商品ページ(/moshi2/)と内容が競合するのも避けたい。
    robots: { index: false, follow: false },
    alternates: { canonical: `/${cert.id}/moshi2/print/` },
  };
}

export default async function Moshi2PrintPage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  const p = moshi2ProductOf(certId);
  if (!cert || !p) notFound();

  return (
    <div>
      {/* パンくず(画面のみ。紙面には出さない) */}
      <nav className="print-hide text-[12px] text-ink-faint mb-4 flex flex-wrap gap-1">
        <Link href="/" className="hover:text-ink-soft underline underline-offset-2">
          ホーム
        </Link>
        <span>/</span>
        <Link href={`/${cert.id}/`} className="hover:text-ink-soft underline underline-offset-2">
          {cert.name} 練習問題
        </Link>
        <span>/</span>
        <Link
          href={`/${cert.id}/moshi2/`}
          className="hover:text-ink-soft underline underline-offset-2"
        >
          模擬試験 第2回
        </Link>
        <span>/</span>
        <span className="text-ink-soft">印刷用</span>
      </nav>

      <div className="print-hide mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[27px] font-medium text-ink leading-snug tracking-tight">
          {cert.name} 模擬試験 第2回 印刷用
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          問題編・解答用紙・解答解説を A4 に組んだ紙面です。印刷しても、PDF として保存しても
          お使いいただけます。画面で時間を計って解き、紙で書き込みながら復習する、
          といった使い分けができます。
        </p>
      </div>

      <Moshi2Print certId={cert.id} />
    </div>
  );
}
