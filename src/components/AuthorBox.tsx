import Link from "next/link";
import { AUTHOR } from "@/data/site";

// 著者(編集部)ボックス。構造化データの Person(@id=/#author) と可視情報を一致させる
// E-E-A-T パーツ。資格入口・分野別一問一答・コラム詳細で共用する。
export default function AuthorBox({ className = "" }: { className?: string }) {
  return (
    <aside className={`rounded-[10px] border border-line bg-surface p-4 flex items-start gap-3 ${className}`}>
      <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-paper font-serif text-[15px] shrink-0">
        {AUTHOR.name.slice(0, 1)}
      </span>
      <div>
        <div className="text-[12px] text-ink font-medium">
          {AUTHOR.name}
          <span className="ml-2 text-[11px] text-ink-soft">{AUTHOR.jobTitle}</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-soft leading-relaxed">{AUTHOR.description}</p>
        <Link
          href="/about/"
          className="inline-block mt-1.5 text-[11px] text-accent-ink hover:text-accent underline underline-offset-2"
        >
          運営者情報・編集方針 →
        </Link>
      </div>
    </aside>
  );
}
