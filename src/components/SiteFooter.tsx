import Link from "next/link";
import { SITE } from "@/data/site";
import { QUESTIONS, CERTS, questionsOfCert } from "@/data/questions";

export default function SiteFooter() {
  const certs = CERTS.filter((c) => questionsOfCert(c.id).length > 0);
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-3xl px-6 py-6 text-[11px] text-ink-soft">
        {/* 全ページ共通の内部リンク(資格別入口ページへのクロールパスを保証する) */}
        <div className="mb-4 pb-4 border-b border-line">
          <div className="text-ink-faint mb-2">試験別の練習問題</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {certs.map((c) => (
              <li key={c.id}>
                <Link href={`/${c.id}/`} className="hover:text-accent transition">
                  {c.name} 練習問題
                </Link>
              </li>
            ))}
            <li>
              <Link href="/columns/" className="hover:text-accent transition">
                資格コラム
              </Link>
            </li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="tabular">
            全 {QUESTIONS.length} 問 ・ {CERTS.length}試験に対応
          </span>
          <Link href="/about/" className="text-ink-faint hover:text-accent transition">
            編集部が作成・問題は随時更新
          </Link>
        </div>
        <p className="mt-3 text-ink-faint leading-relaxed">
          ※ 本サイトは第一種・第二種衛生管理者試験の学習に向けた対策演習問題です。試験の公式問題ではありません。
          内容は公式の出題範囲と一般的な労働衛生の知識にもとづき作成していますが、最新の法令・公式テキストもあわせてご確認ください。
        </p>
        <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-faint">
          <span>関連サービス</span>
          <a
            href={`${SITE.studioUrl}?utm_source=eisei&utm_medium=referral&utm_content=footer`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition"
          >
            シカクモンスタジオ(AIで自分専用の問題集)→
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-faint">
          <Link href="/about/" className="hover:text-accent transition">
            運営者情報・編集方針
          </Link>
          <Link href="/privacy/" className="hover:text-accent transition">
            プライバシーポリシー
          </Link>
          <Link href="/contact/" className="hover:text-accent transition">
            お問い合わせ
          </Link>
        </div>
      </div>
    </footer>
  );
}
