import type { Metadata } from "next";
import Link from "next/link";
import { SITE, OG_BASE } from "@/data/site";

const PAGE_TITLE = "お問い合わせ";
const PAGE_DESC = `${SITE.name}へのお問い合わせ・問題の誤りのご指摘はこちらから。`;
const CONTACT_EMAIL = "eisei@shikakumon.com";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: "/contact/" },
  openGraph: {
    ...OG_BASE,
    title: PAGE_TITLE,
    description: PAGE_DESC,
    type: "website",
    url: "/contact/",
  },
};

export default function ContactPage() {
  return (
    <div className="fade-up">
      <div className="mb-7 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[26px] font-medium text-ink leading-snug tracking-tight">
          お問い合わせ
        </h1>
      </div>

      <div className="text-[13px] text-ink leading-relaxed">
        <p>
          {SITE.name}へのご意見・ご要望、問題や解説の誤りのご指摘は、下記のメールアドレスまでお寄せください。
          誤りのご指摘は特に歓迎します。確認のうえ、事実に基づいて修正します。
        </p>
        <p className="mt-5">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-block rounded-[8px] border border-line-strong bg-surface px-5 py-3 text-[14px] text-accent-ink no-underline transition hover:border-accent"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-5 text-[12px] text-ink-soft">
          ※ 内容によっては返信までお時間をいただく場合や、返信いたしかねる場合があります。
          運営者・編集方針については
          <Link href="/about/" className="text-accent-ink underline underline-offset-2 mx-0.5">
            運営者情報
          </Link>
          をご覧ください。
        </p>
      </div>
    </div>
  );
}
