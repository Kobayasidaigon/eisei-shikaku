"use client";

/**
 * 第1回模試の結果画面に置く、第2回(有料)への購入導線カード。
 *
 * 【2026-09-20 改修】判定別に出し分ける。それまでは全員に同じ「もう1回分、別問題で
 *   本番形式を通す」+価格入りボタンを見せていて、28日間で表示678人→クリック7人。
 *   価格を見た時点で選別され、買う理由(合格に近づく理由)が書かれていなかった。
 *   訴求を「2回目の実力測定」から「本番前の最終確認・弱点が埋まったかの確認」に変え、
 *   得点・弱点分野・試験日までの日数を差し込む。価格はボタンから外し、注記に回す。
 *
 * 置き場所(判定の直後)は変えない。点数と弱点を見た直後が動機のいちばん強い瞬間のため。
 *
 * 【パラメータ名】設置場所は `placement` で送る(GA4 のカスタム定義に登録済みの名前)。
 *   verdict(fail/near/pass)と days_to_exam を添えて、どの帯が買うのかを分解できるようにする。
 */

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CertId } from "@/data/certs";
import { certById } from "@/data/certs";
import { moshi2ProductOf } from "@/data/products";
import {
  daysToNextExam,
  moshi2Verdict,
  trackMoshi2,
  type Moshi2ResultSummary,
} from "@/lib/moshi2-funnel";

export default function Moshi2Offer({
  certId,
  placement,
  result,
  className = "",
}: {
  certId: CertId;
  /** GA4 で設置場所を区別する(moshi_result など) */
  placement: string;
  /** 第1回の結果。無ければ判定なしの共通文面になる */
  result?: Moshi2ResultSummary;
  className?: string;
}) {
  const product = moshi2ProductOf(certId);
  const cert = certById(certId);
  const ref = useRef<HTMLElement | null>(null);
  const fired = useRef(false);

  const verdict = result ? moshi2Verdict(result) : "pass";
  const days = daysToNextExam(product?.examDates);
  const params = { cert: certId, placement, verdict, days_to_exam: days ?? undefined };

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current || !product || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired.current || !entries.some((e) => e.isIntersecting)) return;
        fired.current = true;
        trackMoshi2("moshi2_offer_impression", params);
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
    // params は毎レンダー新しいオブジェクトになるが、中身は certId/placement/result で決まる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certId, placement, product, verdict, days]);

  if (!product || !cert) return null;

  const gap = result ? Math.max(0, result.gap) : 0;
  const unit = result?.unit ?? "問";
  const passLine = result?.passLine ?? product.passCount;
  const worst = result?.worstCategory;
  const worstPct = result?.worstPct;
  const weakLine = worst
    ? `いちばん落としたのは「${worst}」(正答率${worstPct ?? 0}%)。`
    : "";

  let heading: string;
  let body: string;
  if (verdict === "fail") {
    heading =
      gap > 0 ? `合格ラインまで あと${gap}${unit}` : "総合は合格ライン超え。科目別の基準が残っています";
    body =
      `${weakLine}練習問題で復習したあと、第1回と1問も重複しない第2回で` +
      `「本当に伸びたか」を本番と同じ${product.timeLimitMin}分で確かめましょう。`;
  } else if (verdict === "near") {
    heading =
      gap > 0 ? `あと${gap}${unit}。ここが伸びしろです` : "総合は合格ライン超え。あとは科目別の基準だけです";
    body =
      (worst ? `「${worst}」を復習してから、` : "弱かった分野を復習してから、") +
      `初見の${product.questionCount}問でもう一度。第1回と同じ条件なので、伸びがそのまま点数で分かります。`;
  } else {
    heading = "合格圏。ただし本番は初見の問題です";
    body =
      `第1回と1問も重複しない第2回で、初見でも${passLine}${unit}を越えられるか` +
      "最終確認をしておくと安心です。";
  }

  return (
    <section
      ref={ref}
      className={`bg-surface border border-accent/40 rounded-[10px] p-5 mb-5 ${className}`}
    >
      {days != null && (
        <p className="text-[12px] text-accent-ink tabular mb-1.5">
          {cert.name} 本試験まで あと{days}日
        </p>
      )}
      <p className="text-[11px] text-ink-faint tracked mb-1.5">第2回模擬試験(本番前の最終確認)</p>
      <h3 className="font-serif text-[17px] font-medium text-ink mb-2 leading-snug">{heading}</h3>
      <p className="text-[13px] text-ink-soft leading-relaxed mb-3">{body}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-col items-start gap-1">
          <Link
            href={`/${certId}/moshi2/?src=result`}
            onClick={() => trackMoshi2("moshi2_offer_click", params)}
            className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] no-underline hover:bg-accent transition-colors"
          >
            第2回模試の内容を見る →
          </Link>
          <span className="text-[11px] text-ink-faint tabular">
            ¥{product.priceJpy.toLocaleString()}・買い切り・登録不要・全問解説つき
          </span>
        </div>
        <Link
          href={`/${certId}/moshi2/#sample`}
          onClick={() => trackMoshi2("moshi2_offer_click", { ...params, target: "sample" })}
          className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          サンプル問題を見る
        </Link>
      </div>
    </section>
  );
}
