"use client";

/**
 * 資格トップに置く第2回(有料)の案内カード。
 *
 * 【なぜカードにしたか】以前は Moshi2TopLink という枠線ボタンで、
 *   「第1回を受ける(無料)」と同じ行に並べていた。同じ行に無料の選択肢がある限り
 *   有料は押されない。実測(2026-08-19〜09-08・3サイト)で、オファー表示519人に対し
 *   クリックは6人=1.2%。クリック後は checkout 83%・購入80%と高いので、
 *   詰まっていたのは価格でも決済でもなく「無料の隣に置いたこと」だった。
 *   そこで無料の模試カードとは別ブロックに分け、値段だけのボタンではなく
 *   「第1回と何が違うのか」を具体的に書く。派手にはしない(枠は無料カードと同じ静かな線)。
 *
 * 計測は結果画面の Moshi2Offer と同じ moshi2_offer_impression / moshi2_offer_click を
 * placement だけ変えて送る。そうしないと、どちらの設置場所が効いたかを比べられない。
 * パラメータ名が placement なのは、GA4 のカスタム定義に登録済みの名前がこれだから。
 */

import Link from "next/link";
import { useEffect, useRef } from "react";

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

export default function Moshi2TopCard({
  certId,
  priceJpy,
  questionCount,
  timeLimitMin,
  placement = "cert_top",
  className = "",
}: {
  certId: string;
  priceJpy: number;
  questionCount: number;
  timeLimitMin: number;
  /** GA4 で設置場所を区別する */
  placement?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired.current || !entries.some((e) => e.isIntersecting)) return;
        fired.current = true;
        track("moshi2_offer_impression", { cert: certId, placement });
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [certId, placement]);

  return (
    <section
      ref={ref}
      className={`mb-6 bg-surface border border-line rounded-[10px] p-4 ${className}`}
    >
      <p className="text-[11px] text-ink-faint tracked mb-1.5">第2回模擬試験(有料)</p>
      <h2 className="font-serif text-[16px] font-medium text-ink mb-2 leading-snug">
        第1回と1問も重複しない、2回目の実力測定
      </h2>
      <p className="text-[13px] text-ink-soft leading-relaxed mb-3">
        本試験と同じ{questionCount}問・{timeLimitMin}分。自動採点・分野別の弱点分析・全問の解説に加え、
        問題と解答用紙と解説を A4 に組んだ印刷用の紙面(PDF保存可)つきです。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${certId}/moshi2/`}
          onClick={() => track("moshi2_offer_click", { cert: certId, placement })}
          className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] no-underline hover:bg-accent transition-colors"
        >
          第2回を見る(¥{priceJpy.toLocaleString()}) →
        </Link>
        <span className="text-[12px] text-ink-faint">
          買い切り・登録不要。サンプル問題を解説つきで2問公開しています
        </span>
      </div>
    </section>
  );
}
