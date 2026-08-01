import Link from "next/link";
import { SITE } from "@/data/site";

export default function SiteHeader() {
  return (
    <header className="bg-paper border-b border-line-strong">
      <div className="mx-auto max-w-3xl px-6 py-5 flex items-end justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="block w-3.5 h-3.5 bg-accent" aria-hidden />
          <div className="leading-tight">
            <div className="font-serif text-[19px] font-medium tracking-tight text-ink">
              {SITE.name}
            </div>
            <div className="text-[11px] text-ink-soft mt-0.5">{SITE.tagline}</div>
          </div>
        </Link>
        <nav aria-label="サイトナビ" className="flex items-center gap-4 text-[13px] shrink-0">
          <Link href="/" className="text-ink-soft hover:text-accent transition">
            演習
          </Link>
          <Link href="/columns/" className="text-ink-soft hover:text-accent transition">
            コラム
          </Link>
        </nav>
      </div>
    </header>
  );
}
