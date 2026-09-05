"use client";

/**
 * 資格別の講座アフィリエイトCTA。
 *
 * ドリルの採点結果画面(QuizApp)と模擬試験の合否判定画面(MoshiExam)の、
 * どちらも「弱点が見えた直後 = 意欲のピーク」に置く共通コンポーネント。
 *
 * リンク未設定(href が空)のときは何も描画しない。これにより、A8の提携が
 * 承認されるまでは偽リンクや空リンクが表示されない。
 *
 * 無料オファー(資料請求・無料体験)は設定されていれば有料講座CTAより先に出す。
 * 申込みの摩擦が小さく、発生件数を取りやすいため。
 *
 * 2026-08-07 UX監査対応:
 * - cta_impression(placement別)を送信し、course_click と組でCTRを実測できるようにした
 * - 点数直下に置く圧縮版 CompactCourseCTA を追加(結果画面の上下2面でどちらが
 *   押されるかを placement=quiz_result_top / quiz_result で比較する)
 */

import { useEffect, useRef } from "react";
import { CERT_AFFILIATE } from "@/data/affiliate";
import A8Imp from "@/components/A8Imp";
import type { CertId } from "@/data/certs";

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

/**
 * CTAが50%以上画面に入ったら一度だけ cta_impression を送る。
 * course_click / cta_impression の比がそのままCTRになる。
 */
function useCtaImpression<T extends HTMLElement>(placement: string, course?: string) {
  const ref = useRef<T | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired.current || !entries.some((e) => e.isIntersecting)) return;
        fired.current = true;
        track("cta_impression", { placement, course });
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [placement, course]);
  return ref;
}

export default function CourseAffiliateCTA({
  certId,
  placement,
  className = "",
}: {
  certId: CertId;
  /** GA4で設置場所を区別する(quiz_result / moshi_result) */
  placement: string;
  className?: string;
}) {
  const target = CERT_AFFILIATE[certId];
  const impressionRef = useCtaImpression<HTMLDivElement>(placement, target?.course);
  if (!target) return null;

  // 2026-09-05: SMART合格講座(無料登録=低摩擦・講座ページ=有料の第2候補)を併載。
  // 無料カードは SMART 無料登録があればそれを主、LEC 資料請求を同カード内の副リンクにする
  // (本体で SMART 無料登録の CVR 実績がある)。無ければ従来どおり LEC 資料請求が主。
  const smartCourse = `${target.course}_smart`;
  const freeMain = target.smartFreeHref
    ? { href: target.smartFreeHref, label: target.smartFreeLabel ?? "無料登録して講座を試し見る", course: smartCourse, body: "無料登録すると講義の一部をその場で試し見できます。自分に合う教材か確かめてから決められます。" }
    : target.freeHref
      ? { href: target.freeHref, label: target.freeLabel ?? "資料請求で講座を無料体験する", course: target.course, body: "テキストや講義のサンプルを取り寄せて、自分に合う教材か確かめてから決められます。" }
      : null;
  const freeSub = target.smartFreeHref && target.freeHref
    ? { href: target.freeHref, label: target.freeLabel ?? "資料請求で講座を無料体験する", course: target.course }
    : null;
  const hasPaid = Boolean(target.href);
  const paidSub = target.smartHref ? { href: target.smartHref, label: target.smartLabel ?? "SMART合格講座を見る", course: smartCourse } : null;
  if (!freeMain && !hasPaid) return null;

  return (
    <div className={className} ref={impressionRef}>
      {target.freeHref && <A8Imp href={target.freeHref} />}
      {hasPaid && <A8Imp href={target.href} />}
      {(target.smartFreeHref || target.smartHref) && <A8Imp href={target.smartFreeHref ?? target.smartHref} />}
      {/* 低摩擦オファー(無料登録・資料請求)。設定されていれば有料講座より先に置く */}
      {freeMain && (
        <div className="rounded-[12px] border border-accent/40 bg-accent-wash p-5">
          <a
            href={freeMain.href}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            onClick={() => track("free_lead_click", { placement, course: freeMain.course })}
            className="block no-underline"
          >
            <div className="text-[11px] tracked text-accent-ink">まずは無料で試す【PR】</div>
            <div className="font-serif text-[16px] font-medium text-ink mt-1">{freeMain.label}</div>
            <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">{freeMain.body}</p>
            <span className="inline-block mt-3 text-[13px] text-accent">無料で申し込む →</span>
          </a>
          {freeSub && (
            <p className="mt-3 pt-3 border-t border-accent/30 text-[12px] text-ink-soft leading-relaxed">
              紙の資料で比べたい方は
              <a
                href={freeSub.href}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                onClick={() => track("free_lead_click", { placement: `${placement}_sub`, course: freeSub.course })}
                className="ml-1.5 text-accent underline underline-offset-2 hover:text-accent-ink"
              >
                {freeSub.label} →
              </a>
            </p>
          )}
        </div>
      )}

      {/* 有料講座 */}
      {hasPaid && (
        <a
          href={target.href}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          onClick={() => track("course_click", { placement, course: target.course })}
          className={`block rounded-[12px] bg-accent text-white p-5 transition hover:bg-accent-ink no-underline ${
            freeMain ? "mt-3" : ""
          }`}
        >
          <div className="text-[11px] tracked text-paper/70">弱点が見えた今がチャンス【PR】</div>
          <div className="font-serif text-[17px] font-medium mt-1">{target.label}</div>
          <p className="text-[12px] text-paper/85 mt-1.5 leading-relaxed">
            苦手分野を効率よく。通信講座なら、要点整理から模擬試験まで体系的に対策できます。
          </p>
          <span className="inline-block mt-3 text-[13px] underline underline-offset-2">講座を見る →</span>
        </a>
      )}
      {/* 有料講座の第2候補(SMART)。カードは増やさず1行で添える */}
      {paidSub && (
        <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">
          <span className="text-[10px] text-ink-faint mr-1.5">【PR】</span>
          スマホ完結で安く済ませたい方は
          <a
            href={paidSub.href}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            onClick={() => track("course_click", { placement: `${placement}_sub`, course: paidSub.course })}
            className="ml-1.5 text-accent underline underline-offset-2 hover:text-accent-ink"
          >
            {paidSub.label} →
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * 点数直下に置く1〜2行の圧縮版CTA。
 * lead には「合格ラインまであと◯問」「弱点分野名」など、その場の結果に
 * 紐づく一言を渡す(汎用文言より意欲との接続が強い)。
 */
export function CompactCourseCTA({
  certId,
  placement,
  lead,
  className = "",
}: {
  certId: CertId;
  placement: string;
  lead: string;
  className?: string;
}) {
  const target = CERT_AFFILIATE[certId];
  const impressionRef = useCtaImpression<HTMLDivElement>(placement, target?.course);
  if (!target?.href) return null;

  // 2026-09-05: 問題ページ・分野ページ(約1,000面)にも低摩擦の無料登録(SMART)を1行添える。
  // 従来は有料講座リンクだけで、無料オファーが結果画面にしか出ていなかった。
  const free = target.smartFreeHref
    ? { href: target.smartFreeHref, label: target.smartFreeLabel ?? "無料登録して講座を試し見る", course: `${target.course}_smart` }
    : null;

  return (
    <div ref={impressionRef} className={className}>
      <a
        href={target.href}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        onClick={() => track("course_click", { placement, course: target.course })}
        className="block rounded-[10px] border border-accent/40 bg-accent-wash px-4 py-3.5 transition hover:border-accent no-underline"
      >
        <div className="text-[13px] text-ink leading-relaxed">
          {lead}
          <span className="text-[10px] text-ink-faint ml-1.5">【PR】</span>
        </div>
        <span className="inline-block mt-1 text-[13px] text-accent font-medium">
          {target.label} →
        </span>
      </a>
      {free && (
        <p className="mt-1.5 px-1 text-[12px] text-ink-soft leading-relaxed">
          <span className="text-[10px] text-ink-faint mr-1.5">【PR】</span>
          まず講義を無料で試すなら
          <a
            href={free.href}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            onClick={() => track("free_lead_click", { placement, course: free.course })}
            className="ml-1.5 text-accent underline underline-offset-2 hover:text-accent-ink"
          >
            {free.label} →
          </a>
        </p>
      )}
      <A8Imp href={target.href} />
      {free && <A8Imp href={free.href} />}
    </div>
  );
}
