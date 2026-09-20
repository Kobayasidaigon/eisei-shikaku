"use client";

/**
 * 子要素が画面に半分以上入ったら GA4 イベントを1回だけ送る薄い包み。
 *
 * 販売ページ(サーバーコンポーネント)のサンプル問題節・価格ボックスが「見られたか」を
 * 数えるために使う。2026-09-20 時点で販売ページの平均エンゲージメントは13秒しかなく、
 * どこまでスクロールされたかが分からないと文面の改善先を決められない。
 */

import { useEffect, useRef, type ReactNode } from "react";
import { trackMoshi2 } from "@/lib/moshi2-funnel";

export default function Moshi2ViewPing({
  event,
  params,
  id,
  className,
  children,
}: {
  event: string;
  params?: Record<string, unknown>;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired.current || !entries.some((e) => e.isIntersecting)) return;
        fired.current = true;
        trackMoshi2(event, params);
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
    // params の中身は event/id で決まる(呼び出し側で固定値を渡す)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, id]);

  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}
