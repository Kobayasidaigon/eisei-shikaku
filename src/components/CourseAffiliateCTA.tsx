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
 */

import { CERT_AFFILIATE } from "@/data/affiliate";
import type { CertId } from "@/data/certs";

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
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
  if (!target) return null;

  const hasFree = Boolean(target.freeHref);
  const hasPaid = Boolean(target.href);
  if (!hasFree && !hasPaid) return null;

  return (
    <div className={className}>
      {/* 低摩擦オファー(資料請求・無料体験)。設定されていれば有料講座より先に置く */}
      {hasFree && (
        <a
          href={target.freeHref}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          onClick={() => track("free_lead_click", { placement, course: target.course })}
          className="block rounded-[12px] border border-accent/40 bg-accent-wash p-5 transition hover:border-accent no-underline"
        >
          <div className="text-[11px] tracked text-accent-ink">まずは無料で試す【PR】</div>
          <div className="font-serif text-[16px] font-medium text-ink mt-1">
            {target.freeLabel ?? "資料請求で講座を無料体験する"}
          </div>
          <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
            テキストや講義のサンプルを取り寄せて、自分に合う教材か確かめてから決められます。
          </p>
          <span className="inline-block mt-3 text-[13px] text-accent">無料で申し込む →</span>
        </a>
      )}

      {/* 有料講座 */}
      {hasPaid && (
        <a
          href={target.href}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          onClick={() => track("course_click", { placement, course: target.course })}
          className={`block rounded-[12px] bg-accent text-white p-5 transition hover:bg-accent-ink no-underline ${
            hasFree ? "mt-3" : ""
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
    </div>
  );
}
