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
 * 【2026-09-20】ボタンから価格を外し、訴求を「本番前の最終確認」に寄せた。価格が先に
 *   目に入ると、価値を読む前に選別されてしまう(販売ページ到達→13秒で離脱)。価格は
 *   ボタン下に小さく残す(隠すわけではない)。遷移先には ?src=landing を付け、販売ページ側で
 *   結果画面経由(?src=result)と分けて数えられるようにする。
 *
 * 計測は結果画面の Moshi2Offer と同じ moshi2_offer_impression / moshi2_offer_click を
 * placement だけ変えて送る。そうしないと、どちらの設置場所が効いたかを比べられない。
 * パラメータ名が placement なのは、GA4 のカスタム定義に登録済みの名前がこれだから。
 */

import Link from "next/link";
import { useEffect, useRef } from "react";
import { trackMoshi2 } from "@/lib/moshi2-funnel";

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
        trackMoshi2("moshi2_offer_impression", { cert: certId, placement });
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
        本番前の最終確認に。第1回と1問も重複しない初見の{questionCount}問
      </h2>
      <p className="text-[13px] text-ink-soft leading-relaxed mb-3">
        第1回で出た弱点が本当に埋まったかを、本試験と同じ{questionCount}問・{timeLimitMin}分でもう一度確かめる1回分。
        自動採点・分野別の弱点診断・全問の解説に加え、問題と解答用紙と解説を A4 に組んだ印刷用の紙面(PDF保存可)つきです。
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-col items-start gap-1">
          <Link
            href={`/${certId}/moshi2/?src=landing`}
            onClick={() => trackMoshi2("moshi2_offer_click", { cert: certId, placement })}
            className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] no-underline hover:bg-accent transition-colors"
          >
            第2回模試(本番前の最終確認)→
          </Link>
          <span className="text-[11px] text-ink-faint tabular">¥{priceJpy.toLocaleString()}・買い切り</span>
        </div>
        <span className="text-[12px] text-ink-faint">
          登録不要。サンプル問題を解説つきで2問公開しています
        </span>
      </div>
    </section>
  );
}
