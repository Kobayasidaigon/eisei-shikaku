import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import IchimonDrill from "@/components/IchimonDrill";
import { CERTS, certById, type CertId } from "@/data/questions";
import { buildOx } from "@/data/ichimon";

// 一問一答(○×)。2026-11-23 追加。4択の各肢から作るので中身は問題ページと重なる。検索には出さない。
const MIN_ITEMS = 20;

export function generateStaticParams() {
  return CERTS.filter((c) => buildOx(c.id).ox.length >= MIN_ITEMS).map((c) => ({ certId: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ certId: string }> }): Promise<Metadata> {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  if (!cert) return {};
  const title = `${cert.name} 一問一答（○×）`;
  const description = `${cert.fullName}の練習問題の選択肢を、1つずつ○×で答える一問一答。答えるとすぐに正誤と解説が出ます。登録不要・無料。`;
  return {
    title,
    description,
    alternates: { canonical: `/${cert.id}/ichimon/` },
    robots: { index: false, follow: true },
  };
}

export default async function IchimonPage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  const cert = certById(certId as CertId);
  if (!cert) notFound();
  const { ox, sharedExplains } = buildOx(cert.id);
  if (ox.length < MIN_ITEMS) notFound();

  return (
    <div className="fade-up">
      <nav className="text-[12px] text-ink-faint mb-4 flex flex-wrap gap-1" aria-label="パンくずリスト">
        <Link href="/" className="hover:text-ink-soft underline underline-offset-2">
          ホーム
        </Link>
        <span>/</span>
        <Link href={`/${cert.id}/`} className="hover:text-ink-soft underline underline-offset-2">
          {cert.name} 練習問題
        </Link>
        <span>/</span>
        <span className="text-ink-soft">一問一答（○×）</span>
      </nav>

      <div className="mb-6 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[27px] font-medium text-ink leading-snug tracking-tight">
          {cert.name} 一問一答（○×）
        </h1>
      </div>

      <IchimonDrill certId={cert.id} certName={cert.name} ox={ox} sharedExplains={sharedExplains} />
    </div>
  );
}
