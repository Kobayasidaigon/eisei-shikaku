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
        <p className="mt-2 text-[12px] text-ink-faint tabular">制定日 2026-07-10 ・ 最終改訂 2026-09-22</p>
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
            模擬試験の「結果のまとめ・学習リマインド」でお預かりする情報
          </h2>
          <p>
            模擬試験の結果画面で「結果のまとめを受け取る」に登録いただいた場合、メールアドレス・試験日(任意)・
            その回の模擬試験の得点・判定・正答率が低かった分野・登録日時と登録時の画面をお預かりします。
          </p>
          <p className="mt-2">
            利用目的は、結果のまとめのメール送付と、試験日から逆算した学習リマインド(最大6通)の送付です。
            メールには本サイトの練習問題・模擬試験(有料の第2回を含む)と姉妹サービス「シカクモン Studio」の案内を含みます。
            これ以外の目的には利用せず、第三者に提供しません。
          </p>
          <p className="mt-2">
            保存先は姉妹サービス「シカクモン Studio」(同一運営者)のデータベース(Supabase)で、送信には Resend を利用します。
            受験履歴(localStorage)とは別で、模擬試験の解答内容そのものは送信しません。
            配信は各メール末尾のリンクからいつでも停止でき、登録情報の削除は
            <Link href="/contact/" className="text-accent-ink underline underline-offset-2 mx-0.5">
              お問い合わせ
            </Link>
            からご依頼ください。
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
