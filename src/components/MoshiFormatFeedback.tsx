"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CertId } from "@/data/certs";

// 模試結果画面の「本試験と形式は近かったか」ワンタップアンケート。
// 本試験の問題・模範解答が非公開の資格では、受験者の回答が形式の一次情報になる
// (回答は GA4 の moshi_format_feedback イベントで収集)。
function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

type Verdict = "close" | "somewhat" | "different" | "not_taken";

const OPTIONS: { verdict: Verdict; label: string }[] = [
  { verdict: "close", label: "近かった" },
  { verdict: "somewhat", label: "やや違った" },
  { verdict: "different", label: "かなり違った" },
  { verdict: "not_taken", label: "本試験は未受験" },
];

export default function MoshiFormatFeedback({ certId, round }: { certId: CertId; round: number }) {
  const storageKey = `moshiFmtFb:${certId}`;
  const [voted, setVoted] = useState<Verdict | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setVoted((localStorage.getItem(storageKey) as Verdict) || null);
    } catch {
      /* localStorage不可の環境では毎回表示 */
    }
    setLoaded(true);
  }, [storageKey]);

  function vote(verdict: Verdict) {
    track("moshi_format_feedback", { cert: certId, round, verdict });
    try {
      localStorage.setItem(storageKey, verdict);
    } catch {
      /* noop */
    }
    setVoted(verdict);
  }

  if (!loaded) return null;

  return (
    <section className="bg-surface border border-line rounded-[10px] p-5 mb-5">
      {voted ? (
        <p className="text-[13px] text-ink-soft leading-relaxed">
          ご回答ありがとうございます。今後の模試の形式改善に反映します。
          {(voted === "somewhat" || voted === "different") && (
            <>
              {" "}
              よろしければ、どこが違ったか(問題数・出題形式・時間など)を
              <Link href="/contact/" className="underline underline-offset-2 mx-0.5 hover:text-ink">
                お問い合わせ
              </Link>
              から一言お寄せください。
            </>
          )}
        </p>
      ) : (
        <>
          <h3 className="text-[13px] font-medium text-ink mb-1.5">本試験を受けたことがある方へ</h3>
          <p className="text-[12px] text-ink-soft leading-relaxed mb-3">
            この模試の形式(問題数・出題形式・時間)は、実際の本試験と近かったですか?
            回答は模試の形式改善に使わせていただきます。
          </p>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((o) => (
              <button
                key={o.verdict}
                onClick={() => vote(o.verdict)}
                className="rounded-[8px] border border-line-strong bg-paper px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-accent hover:text-ink"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
