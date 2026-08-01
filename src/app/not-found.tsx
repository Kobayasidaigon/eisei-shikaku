import type { Metadata } from "next";
import Link from "next/link";
import { CERTS, questionsOfCert } from "@/data/questions";

// meta robots noindex は Next.js が not-found へ自動注入するため、ここでは指定しない(二重出力回避)
export const metadata: Metadata = {
  title: "ページが見つかりません",
};

export default function NotFound() {
  const certs = CERTS.filter((c) => questionsOfCert(c.id).length > 0);
  return (
    <div className="fade-up">
      <p className="text-[11px] tracked text-ink-faint mb-2">404 Not Found</p>
      <h1 className="font-serif text-[24px] font-medium text-ink leading-snug">
        ページが見つかりません
      </h1>
      <p className="mt-3 text-[13px] text-ink-soft leading-relaxed">
        お探しのページは移動または削除された可能性があります。試験別の練習問題からお探しください。
      </p>
      <ul className="mt-6 space-y-2 text-[13px]">
        <li>
          <Link href="/" className="text-accent-ink hover:text-accent underline underline-offset-2">
            ホーム(演習を始める)
          </Link>
        </li>
        {certs.map((c) => (
          <li key={c.id}>
            <Link
              href={`/${c.id}/`}
              className="text-accent-ink hover:text-accent underline underline-offset-2"
            >
              {c.name} 練習問題
            </Link>
          </li>
        ))}
        <li>
          <Link href="/columns/" className="text-accent-ink hover:text-accent underline underline-offset-2">
            資格コラム一覧
          </Link>
        </li>
      </ul>
    </div>
  );
}
