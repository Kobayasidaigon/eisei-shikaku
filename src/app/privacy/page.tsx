import type { Metadata } from "next";
import Link from "next/link";
import { SITE, OG_BASE } from "@/data/site";

const PAGE_TITLE = "プライバシーポリシー";
const PAGE_DESC = `${SITE.name}のアクセス解析(Google アナリティクス・Vercel Web Analytics)とデータの取り扱いについて。`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: "/privacy/" },
  openGraph: {
    ...OG_BASE,
    title: PAGE_TITLE,
    description: PAGE_DESC,
    type: "website",
    url: "/privacy/",
  },
};

export default function PrivacyPage() {
  return (
    <div className="fade-up">
      <div className="mb-7 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[26px] font-medium text-ink leading-snug tracking-tight">
          プライバシーポリシー
        </h1>
        <p className="mt-2 text-[12px] text-ink-faint tabular">制定日 2026-07-10</p>
      </div>

      <div className="space-y-7 text-[13px] text-ink leading-relaxed">
        <section>
          <h2 className="font-serif text-[16px] font-medium text-ink pb-1.5 border-b border-line mb-3">
            アクセス解析ツールについて
          </h2>
          <p>
            本サイトは、利用状況の把握とサイト改善のために、Google
            アナリティクス(GA4)および Vercel Web Analytics を利用しています。これらのツールはトラフィックデータの収集のために
            Cookie などの識別子を使用することがあります。収集されるデータは匿名で処理され、個人を特定するものではありません。
          </p>
          <p className="mt-2">
            Google アナリティクスによるデータ収集は、Google が提供するオプトアウトアドオン(tools.google.com/dlpage/gaoptout)を利用することで無効にできます。
            データの取り扱いの詳細は、Google のプライバシーポリシー(policies.google.com/privacy)をご確認ください。
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[16px] font-medium text-ink pb-1.5 border-b border-line mb-3">
            受験履歴の保存について
          </h2>
          <p>
            演習の受験履歴・受験者名(任意入力)は、お使いのブラウザの保存領域(localStorage)にのみ保存されます。
            当サイトのサーバーに送信・保存されることはなく、履歴の消去はサイト内の「履歴を消去」またはブラウザのデータ削除からいつでも行えます。
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[16px] font-medium text-ink pb-1.5 border-b border-line mb-3">
            免責事項
          </h2>
          <p>
            本サイトの問題・解説・記事は学習目的の参考情報であり、合格や効果を保証するものではありません。
            試験制度・受験要項の正確な内容は各試験団体の公式サイトでご確認ください。
            本サイトの利用により生じたいかなる損害についても、運営者は責任を負いかねます。
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[16px] font-medium text-ink pb-1.5 border-b border-line mb-3">
            お問い合わせ
          </h2>
          <p>
            本ポリシーに関するお問い合わせは、
            <Link href="/contact/" className="text-accent-ink underline underline-offset-2 mx-0.5">
              お問い合わせページ
            </Link>
            からお願いします。
          </p>
        </section>
      </div>
    </div>
  );
}
