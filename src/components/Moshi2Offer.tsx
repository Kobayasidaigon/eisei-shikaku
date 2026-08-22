"use client";

/**
 * 第2回模試(有料)への購入導線カード。
 *
 * 置き場所として一番効くのは第1回模試の結果画面。点数と弱点を見た直後が、
 * 「もう1回分やりたい」の動機がいちばん強い瞬間のため。
 * 表示・クリックを GA で計測し、どの設置場所が効いたかを見る。
 */

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CertId } from "@/data/certs";
import { moshi2ProductOf } from "@/data/products";

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

export default function Moshi2Offer({
  certId,
  place,
  className = "",
}: {
  certId: CertId;
  /** GA で設置場所を区別する(moshi_result / cert_top など) */
  place: string;
  className?: string;
}) {
  const product = moshi2ProductOf(certId);
  const ref = useRef<HTMLElement | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current || !product || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired.current || !entries.some((e) => e.isIntersecting)) return;
        fired.current = true;
        track("moshi2_offer_impression", { cert: certId, place });
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [certId, place, product]);

  if (!product) return null;

  return (
    <section
      ref={ref}
      className={`bg-surface border border-accent/40 rounded-[10px] p-5 mb-5 ${className}`}
    >
      <p className="text-[11px] text-ink-faint tracked mb-1.5">第2回模擬試験</p>
      <h3 className="font-serif text-[17px] font-medium text-ink mb-2 leading-snug">
        もう1回分、別問題で本番形式を通す
      </h3>
      <p className="text-[13px] text-ink-soft leading-relaxed mb-3">
        {product.description}
        第1回で出た弱点が本当に埋まったかは、別の問題で測らないと分かりません。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${certId}/moshi2/`}
          onClick={() => track("moshi2_offer_click", { cert: certId, place })}
          className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] no-underline hover:bg-accent transition-colors"
        >
          第2回を見る(¥{product.priceJpy.toLocaleString()}) →
        </Link>
        <span className="text-[12px] text-ink-faint">買い切り・登録不要</span>
      </div>
    </section>
  );
}
