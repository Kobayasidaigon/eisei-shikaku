"use client";

/**
 * シカクモン Studio へのリンク(クリック計測付き)。2026-10-03 追加。
 *
 * フッター(SiteFooter)とコラム末尾はサーバーコンポーネントで onClick を持てず、
 * この2か所だけ studio_cta_click が送られていなかった。ColumnScrollPing と同じく
 * サーバーのページに小さな client component を置き、アンカー1個だけを差し替える
 * (ラッパ要素は足さない=見た目を変えない)。
 *
 * 送るもの: studio_cta_click { placement, cert }。cert は資格が分かる面だけ
 * (QuizApp・MoshiExam の studio_cta_click と同じ語彙)。表示回数は送らない。
 * フッターはレイアウト(サーバー)に置くので今いるページを知らない。pathCerts を渡すと、
 * クリックの時点で URL のパスの先頭(/<certId>/…)から cert を読む(資格のページだけ付く)。
 */

import type { ReactNode } from "react";

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

/** URL のパスの先頭が pathCerts のどれかなら、その certId を返す(フッター用) */
function certFromPath(pathCerts?: readonly string[]): string | undefined {
  if (!pathCerts || typeof window === "undefined") return undefined;
  const head = window.location.pathname.split("/")[1] ?? "";
  return pathCerts.includes(head) ? head : undefined;
}

export default function StudioLink({
  href,
  placement,
  cert,
  pathCerts,
  className = "",
  children,
}: {
  href: string;
  /** GA4で設置面を区別する(footer / column) */
  placement: string;
  /** certId。資格に紐づかない面(フッター・資格の無いコラム)では省略 */
  cert?: string;
  /** cert を省略した面で、パスの先頭から cert を読むときの資格IDの一覧(フッター用) */
  pathCerts?: readonly string[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        const c = cert ?? certFromPath(pathCerts);
        track("studio_cta_click", c ? { placement, cert: c } : { placement });
      }}
      className={className}
    >
      {children}
    </a>
  );
}
