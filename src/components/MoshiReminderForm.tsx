"use client";

/**
 * 第1回模試の結果画面に置く「結果のまとめと学習リマインドを受け取る」フォーム。2026-09-22 追加。
 *
 * 置き場所は第2回オファー (Moshi2Offer / MoshiRound2Interest) の直後。オファーの位置は
 * 2026-09-21 改修の判定 (2 週間ごと) が続いているので動かさない。
 *
 * もらうのはメールアドレスと試験日 (任意) だけ。同意はチェックボックスでなく、
 * ボタン直下の一文 (何が何通届くか・いつでも停止できる) で示す。
 * 送信先は Studio の API (lib/moshi-reminder.ts)。このサイトには何も保存しない。
 *
 * GA4: moshi_reminder_view (半分見えたら 1 回) / moshi_reminder_submit / moshi_reminder_error。
 * パラメータは cert / placement / verdict / has_exam_date。
 *
 * 他のドリルサイト (kintore / eisei) と同じファイル。
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CertId } from "@/data/certs";
import { moshi2Verdict, type Moshi2ResultSummary } from "@/lib/moshi2-funnel";
import {
  moshiReminderStorageKey,
  submitMoshiReminder,
  trackMoshiReminder,
} from "@/lib/moshi-reminder";

type Status = "idle" | "sending" | "done" | "error";

/** JST の今日 "YYYY-MM-DD" (input[type=date] の min 用) */
function todayYmd(): string {
  const shifted = new Date(Date.now() + 9 * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

function plusDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export default function MoshiReminderForm({
  certId,
  certName,
  round,
  score,
  result,
  moshi2Path,
  defaultExamDate,
  placement = "moshi_result",
}: {
  certId: CertId;
  certName: string;
  round: number;
  score: number;
  result: Moshi2ResultSummary;
  moshi2Path?: string | null;
  /** 公式日程から引いた次回試験日 "YYYY-MM-DD"。無ければ空欄で出す */
  defaultExamDate?: string | null;
  placement?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [already, setAlready] = useState(false);
  const [examDate, setExamDate] = useState(defaultExamDate ?? "");
  const ref = useRef<HTMLElement | null>(null);
  const viewed = useRef(false);

  const verdict = moshi2Verdict(result);
  const storageKey = moshiReminderStorageKey(certId);
  const topPath = `/${certId}/`;

  useEffect(() => {
    try {
      setAlready(!!localStorage.getItem(storageKey));
    } catch {
      /* localStorage 不可の環境では毎回表示 */
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el || viewed.current || !loaded || already || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (viewed.current || !entries.some((e) => e.isIntersecting)) return;
        viewed.current = true;
        trackMoshiReminder("moshi_reminder_view", { cert: certId, placement, verdict });
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [certId, placement, verdict, loaded, already]);

  if (round !== 1 || !loaded) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage("");
    const fd = new FormData(e.currentTarget);
    const outcome = await submitMoshiReminder({
      email: String(fd.get("email") ?? "").trim(),
      cert: certId,
      certName,
      examDate: String(fd.get("examDate") ?? ""),
      verdict,
      score,
      result,
      topPath,
      moshi2Path: moshi2Path ?? null,
      website: String(fd.get("website") ?? ""),
    });
    if (!outcome.ok) {
      setStatus("error");
      setMessage(outcome.error);
      trackMoshiReminder("moshi_reminder_error", { cert: certId, placement, verdict });
      return;
    }
    setStatus("done");
    trackMoshiReminder("moshi_reminder_submit", {
      cert: certId,
      placement,
      verdict,
      has_exam_date: examDate ? 1 : 0,
    });
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      /* noop */
    }
  }

  const inputClass =
    "w-full rounded-[8px] border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent";
  const labelClass = "block text-[11px] text-ink-soft mb-1";

  if (already && status !== "done") {
    return (
      <section className="bg-surface border border-line rounded-[10px] p-5 mb-5">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          この資格の結果まとめ・学習リマインドは登録済みです。届いていない場合は迷惑メールフォルダをご確認ください。
          もう一度受けて結果を更新したいときは、
          <button
            type="button"
            onClick={() => setAlready(false)}
            className="underline underline-offset-2 hover:text-ink mx-0.5"
          >
            再登録
          </button>
          できます(試験日も更新されます)。
        </p>
      </section>
    );
  }

  if (status === "done") {
    return (
      <section className="bg-surface border border-line rounded-[10px] p-5 mb-5">
        <p className="font-serif text-[15px] font-medium text-ink mb-1.5">登録しました</p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          数分以内に「結果のまとめ」のメールが届きます。届かないときは迷惑メールフォルダをご確認ください。
          {examDate
            ? "そのあとは試験日から逆算して、30日前・2週間前・1週間前・前日にリマインドをお送りします。"
            : "試験日が決まったら、この画面から再登録すると試験日逆算のリマインドに切り替わります。"}
        </p>
      </section>
    );
  }

  const today = todayYmd();
  const worst = result.worstCategory;

  return (
    <section ref={ref} className="bg-surface border border-line rounded-[10px] p-5 mb-5">
      <p className="text-[11px] text-ink-faint tracked mb-1.5">結果のまとめと学習リマインド(無料)</p>
      <h3 className="font-serif text-[17px] font-medium text-ink mb-2 leading-snug">
        この結果を、試験日まで活かす
      </h3>
      <p className="text-[13px] text-ink-soft leading-relaxed mb-4">
        {worst ? `いちばん落とした「${worst}」と合格ラインまでの差を` : "合格ラインまでの差と落とした分野を"}
        、いま1通のメールにまとめて送ります。そのあとは試験日から逆算して、30日前・2週間前・1週間前・前日に短いリマインドを届けます(最大6通)。
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor={`mr-email-${certId}`} className={labelClass}>
              メールアドレス
            </label>
            <input
              id={`mr-email-${certId}`}
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`mr-date-${certId}`} className={labelClass}>
              試験日(任意・未定なら空欄)
            </label>
            <input
              id={`mr-date-${certId}`}
              name="examDate"
              type="date"
              value={examDate}
              min={today}
              max={plusDaysYmd(today, 450)}
              onChange={(ev) => setExamDate(ev.target.value)}
              className={`${inputClass} tabular`}
            />
          </div>
        </div>
        {/* ハニーポット: 人間には見えない。bot が埋めたらサーバー側で黙殺する */}
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {status === "error" && message && (
          <p className="text-[12px] text-wrong leading-relaxed">{message}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={status === "sending"}
            className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] hover:bg-accent transition-colors disabled:opacity-60"
          >
            {status === "sending" ? "送信中…" : "結果のまとめを受け取る"}
          </button>
          <span className="text-[11px] text-ink-faint leading-relaxed">
            登録すると上記のメールをお送りします。各メールのリンクからいつでも停止でき、アドレスは他の目的に使いません(
            <Link href="/privacy/" className="underline underline-offset-2 hover:text-ink">
              プライバシーポリシー
            </Link>
            )。
          </span>
        </div>
      </form>
    </section>
  );
}
