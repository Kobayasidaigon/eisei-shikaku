"use client";

/**
 * 資格トップに置く第2回への導線ボタン。
 *
 * 結果画面の Moshi2Offer と同じ moshi2_offer_impression / moshi2_offer_click を
 * place だけ変えて送る。そうしないと、どちらの設置場所が効いたかを比べられない。
 * 資格トップは模試ページより人数が多い入口なので、ここが無計測だと
 * ファネルの上流が丸ごと見えなくなる。
 */

import Link from "next/link";
import { useEffect, useRef } from "react";

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

export default function Moshi2TopLink({
  certId,
  priceJpy,
  place = "cert_top",
  className = "",
}: {
  certId: string;
  priceJpy: number;
  /** GA4 で設置場所を区別する */
  place?: string;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current || typeof IntersectionObserver === "undefined") return;
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
  }, [certId, place]);

  return (
    <Link
      ref={ref}
      href={`/${certId}/moshi2/`}
      onClick={() => track("moshi2_offer_click", { cert: certId, place })}
      className={className}
    >
      第2回(¥{priceJpy.toLocaleString()}) →
    </Link>
  );
}
